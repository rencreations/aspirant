/**
 * The page's snap: where the scroll comes to rest when the visitor lets go inside a joint. Pure
 * arithmetic and a small state machine; the engine feeds it the frame's facts and does the moving.
 *
 * JOINT SNAP. A section with plays rests between two thresholds (a dwell): `update` gets a number that
 * does not follow the scroll there, so any position in a dwell is a rest. The places that are not rests
 * are the joints, where a section's lead or tail is on screen and follows the scroll (and the ground
 * cross-fades): two sections are on screen at once. When the visitor lets go inside a joint the page
 * runs on its own, in half a second, to the nearer rest: the end of the dwell of the section before,
 * or the start of the dwell of the one after. It never goes where a play would fire (a play is a scene,
 * not a place to rest), so a joint with a threshold in it snaps one way only.
 *
 * The scene's top speed, which keeps a hard scroll from skipping or cutting the scenes, is
 * `kernel/speed.ts`. A snap waits while the scene is still behind the page (`chasing`).
 *
 * Units: screens (the scroll in `unit` pixels), milliseconds on the wall clock for time.
 * `docs/design/home/kernel-snap.md` says how to look at it.
 */
import { GROUND_FADE } from "./background";
import type { Layout } from "./layout";

/** The scroll has to be still, and nobody pushing, this long before the page runs to a rest. */
export const SNAP_IDLE_MS = 180;
/** No snap this soon after a seek, a jump or the load (a frame sheet waits here). */
export const SNAP_GRACE_MS = 600;
/** The length of the move to the rest, in seconds. */
export const SNAP_SECONDS = 0.5;
/** The scroll moves this many pixels or more: it is still moving. */
const MOVE_EPS_PX = 1.5;
/** A position this close (screens) to a joint's edge counts as outside it (a landing is a pixel off). */
export const ZONE_INSET = 0.02;
/** A rest is kept this far (screens) from a threshold, so landing next to it never fires or unfires a play. */
export const THRESHOLD_MARGIN = 0.012;
/** A move of less than this (screens) is not worth making. */
const MIN_MOVE = 0.01;
/** The move is over when the page is this near (screens) its target. */
const ARRIVED = 0.004;

/** A joint: the scroll range in which two sections are on screen and one of them follows the scroll. */
export interface JointZone {
  /** Where the first part starts (screens). Outside it, on its start side, the page rests. */
  readonly from: number;
  /** Where the last part ends. */
  readonly to: number;
}

const EPS = 1e-9;

/**
 * The joints of a page, in scroll order and never overlapping. A joint is made of the lead of a
 * section (where its scene is still coming in and follows the scroll), its tail (where it is leaving),
 * and the ground cross-fade between two grounds of a pair that follow the scroll. A section that
 * rests in its lead and tail (`restOutside`) has none, and the ground of such a pair is its scene's
 * own. A section with no plays follows the scroll over its whole range, so nothing near it snaps.
 */
export function jointZones(layout: Layout): JointZone[] {
  const raw: JointZone[] = [];
  const blocked: JointZone[] = [];
  const list = layout.placed;
  list.forEach((p, i) => {
    if (!p.def.plays || p.def.manualScroll) {
      blocked.push({ from: p.from, to: p.to });
      return;
    }
    if (p.def.restOutside) return;
    if (p.def.lead > 0) raw.push({ from: p.from, to: p.start });
    if (p.def.tail > 0) raw.push({ from: p.end, to: p.to });
    const before = list[i - 1];
    if (before && !before.def.restOutside && before.def.plays && before.def.bg !== p.def.bg) {
      raw.push({ from: p.start - GROUND_FADE / 2, to: p.start + GROUND_FADE / 2 });
    }
  });
  raw.sort((a, b) => a.from - b.from);
  const merged: JointZone[] = [];
  for (const z of raw) {
    const last = merged[merged.length - 1];
    if (last && z.from <= last.to + EPS) {
      merged[merged.length - 1] = { from: last.from, to: Math.max(last.to, z.to) };
    } else {
      merged.push(z);
    }
  }
  // A joint that touches a section that never rests is not a joint to snap in.
  return merged.filter((z) => !blocked.some((b) => z.from < b.to && z.to > b.from));
}

/** Every threshold of every section's plays, in screens from the top of the page, ascending. */
export function playThresholds(layout: Layout): number[] {
  const out: number[] = [];
  for (const p of layout.placed) {
    for (const play of p.def.plays ?? []) {
      out.push(p.start + play.at * p.def.screens);
      // A zone is not a place to rest: its far end is a threshold too (the joint snap keeps clear of both).
      if (play.span !== undefined) out.push(p.start + (play.at + play.span) * p.def.screens);
    }
  }
  return out.sort((a, b) => a - b);
}

/** A clock play that fires by itself (`HomePlay.auto`): its threshold and how far in front it carries. */
export interface AutoPlay {
  readonly at: number;
  readonly reach: number;
}

/** The clock plays that fire by themselves, in screens, by threshold. */
export function autoThresholds(layout: Layout): AutoPlay[] {
  const out: AutoPlay[] = [];
  for (const p of layout.placed) {
    for (const play of p.def.plays ?? []) {
      if (play.auto !== undefined && play.span === undefined)
        out.push({ at: p.start + play.at * p.def.screens, reach: play.auto });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Where the page goes on to from a stop short of an `auto` clock play: just past its threshold, so that
 * it fires. NaN when the page is not within the play's reach (or the visitor was going up).
 */
export function autoTarget(autos: readonly AutoPlay[], s: number, down: boolean): number {
  if (!down) return NaN;
  for (const a of autos) {
    if (a.at > s && a.at - s <= a.reach) return a.at + THRESHOLD_MARGIN;
  }
  return NaN;
}

/** The index of the joint the position is inside (the edges count as outside), or -1. */
export function zoneIndexAt(zones: readonly JointZone[], s: number): number {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]!;
    if (s > z.from + ZONE_INSET && s < z.to - ZONE_INSET) return i;
    if (s < z.from) break;
  }
  return -1;
}

/**
 * The rest to run to from inside a joint: the end of the dwell before it (`zone.from`) or the start of
 * the dwell after it (`zone.to`), whichever is nearer. A rest is never placed where a play would fire or
 * un-fire: going on stops short of the next threshold, going back stops at the last threshold that
 * has fired. A side that cannot get out of the joint that way is not a choice. A tie goes the way
 * the visitor was going (`down`). With `commit` (the last input was a key, which moves a few tens of
 * pixels at a time) the rest in the way the visitor was going is taken whenever it is open, so a key
 * can never be pulled back to where it started. NaN when no side is open (the visitor has to scroll
 * on). `thresholds` is `playThresholds(layout)`.
 */
export function restFor(
  zone: JointZone,
  thresholds: readonly number[],
  s: number,
  down = true,
  commit = false,
): number {
  let prev = -Infinity;
  let next = Infinity;
  for (const t of thresholds) {
    if (t <= s) prev = t;
    else {
      next = t;
      break;
    }
  }
  // Up: stay at or above a threshold that has fired (a fired play stays fired).
  const up = Math.max(zone.from, prev === -Infinity ? zone.from : prev + THRESHOLD_MARGIN);
  const upOk = up <= zone.from + ZONE_INSET;
  // Down: stop short of the next threshold.
  const downTo = Math.min(zone.to, next - THRESHOLD_MARGIN);
  const downOk = downTo >= zone.to - ZONE_INSET;
  const dUp = s - up;
  const dDown = downTo - s;
  if (upOk && downOk) {
    if (commit) return down ? downTo : up;
    return dUp < dDown || (dUp === dDown && !down) ? up : downTo;
  }
  if (upOk) return up;
  if (downOk) return downTo;
  return NaN;
}

/** Why the page does not snap right now, or null when it may. The reasons are in the order they are checked. */
export type SnapBlock =
  | "closed"
  | "frozen"
  | "unarmed"
  | "grace"
  | "moving"
  | "input"
  | "touch"
  | "hold"
  | "play"
  | "chase"
  | "outside"
  | "no-rest"
  | "script"
  | "zone"
  | "free";

/** What the engine tells the snap each frame. Plain numbers and flags, written in place by the caller. */
export interface SnapFrame {
  /** Wall-clock milliseconds. */
  now: number;
  /** The real scroll in screens (`window.scrollY / unit`), not the scene's. */
  real: number;
  /** Pixels in a screen. */
  unit: number;
  /** The home is open (the opening is over). */
  open: boolean;
  /** The probe froze the scene. */
  frozen: boolean;
  /** Wall-clock time of the last wheel or touch, and of the last scroll key (0: none). */
  pushAt: number;
  keyAt: number;
  /** A finger is on the screen. */
  touching: boolean;
  /** How many scroll holds are on right now (a play, a preview, a viewer, the music). */
  holds: number;
  /** A play runs or is waiting for its runtime. */
  playing: boolean;
  /** The scene is still catching up with the page (held to its top speed, `kernel/speed.ts`). */
  chasing: boolean;
  /** A script's own move of the page is on its way (a button, a focus move), not ours. */
  scripted: boolean;
  /** The page is inside a scroll zone (`kernel/scrub.ts`): the zone snap owns the place, not the joint snap. */
  zoned?: boolean;
  /** Which way the last wheel or touch pushed the page (1 down, -1 up): the direction the visitor means, whatever the engine did to the page. */
  pushDir?: 1 | -1;
  /** The engine put the page back this frame (the top speed dropped the rest of a hard scroll): not the visitor's move. */
  pulled?: boolean;
  /**
   * The site's scroll lock is on for a reason the home did not take (the menu, a player, a dialog:
   * the `lenis-stopped` class on `html`). Not a hold of the home's, so `holds` does not count it.
   */
  locked?: boolean;
}

export interface SnapDeps {
  readonly layout: Layout;
  /** Run the page to a position in screens, smoothly, in `seconds`. */
  move(screens: number, seconds: number): void;
  /** Stop a smooth move that is on its way (the smooth scroller's own tween). */
  stop(): void;
  /**
   * Carry the page on past the threshold of a play that fires by itself (`HomePlay.auto`), smoothly, in
   * `seconds`, as a scroll would: the play on the way must fire and play, not land on its place (which
   * `move`, a script's move, makes it do). Without it the carry uses `move`.
   */
  carry?(screens: number, seconds: number): void;
}

/** What `window.__home.snap()` says. */
export interface SnapReport {
  readonly idleMs: number;
  readonly armed: boolean;
  readonly moving: boolean;
  readonly blocked: SnapBlock | null;
  readonly zone: JointZone | null;
  readonly target: number | null;
  readonly zones: number;
  /** Every joint of the page, in screens (for the probes that pick a place to stop). */
  readonly joints: readonly JointZone[];
  /** Every play threshold of the page, in screens. */
  readonly thresholds: readonly number[];
}

/**
 * The joint snap. `step` once a frame, after the plays. It waits until the page has been still and
 * nobody has pushed it for `SNAP_IDLE_MS`, inside a joint, with no play, hold or script move, and
 * only after the visitor has pushed the page since the last seek or load; then it makes one move to
 * the nearer rest. Any input after that cancels it (the engine calls `cancel`).
 */
export class JointSnap {
  private readonly zones: JointZone[];
  private readonly thresholds: number[];
  private readonly autos: AutoPlay[];
  private jumpAt = 0;
  private refReal = NaN;
  private movedAt = 0;
  private movingTo = NaN;
  private movingUntil = 0;
  private lastReal = 0;
  private lastDirDown = true;
  private last: SnapFrame | null = null;
  private lastBlock: SnapBlock | null = "closed";

  constructor(
    private readonly deps: SnapDeps,
    now: number,
  ) {
    this.zones = jointZones(deps.layout);
    this.thresholds = playThresholds(deps.layout);
    this.autos = autoThresholds(deps.layout);
    this.jumpAt = now;
  }

  /** A snap of ours is on its way. */
  get moving(): boolean {
    return !Number.isNaN(this.movingTo);
  }

  /** A seek, a jump, a focus move or the load: no snap for a while, and none until the visitor pushes again. */
  noteJump(now: number): void {
    this.jumpAt = now;
    this.movingTo = NaN;
  }

  /** The visitor pushed the page: a snap that is on its way is over. `keys` also stops the smooth move. */
  cancel(keys = false): void {
    if (Number.isNaN(this.movingTo)) return;
    this.movingTo = NaN;
    if (keys) this.deps.stop();
  }

  /** One frame. */
  step(f: SnapFrame): void {
    this.last = f;
    const eps = MOVE_EPS_PX / Math.max(1, f.unit);
    if (Number.isNaN(this.refReal) || Math.abs(f.real - this.refReal) >= eps) {
      // The page put back by the engine is not a move the visitor made: it does not turn their direction.
      if (!Number.isNaN(this.refReal) && !f.pulled) this.lastDirDown = f.real > this.refReal;
      this.refReal = f.real;
      this.movedAt = f.now;
    }
    // The way the visitor pushed the page last (a wheel or a touch newer than the last key) is the way
    // they mean, whatever the engine did to the page since (a flick put back, a top speed).
    if (f.pushDir !== undefined && f.pushAt > 0 && f.pushAt >= f.keyAt) {
      this.lastDirDown = f.pushDir > 0;
    }
    this.lastReal = f.real;
    // Our own move: over when the page has arrived, or it has had its time.
    if (!Number.isNaN(this.movingTo)) {
      if (Math.abs(f.real - this.movingTo) < ARRIVED || f.now > this.movingUntil) {
        this.movingTo = NaN;
      }
    }
    // Short of a play that fires by itself, going down, on the empty screen in front of it: carry on past
    // its threshold so that it starts. That holds inside a zone with no idle snap too (the end of Selena's
    // film, where the white has already covered the screen).
    let target = autoTarget(this.autos, f.real, this.lastDirDown);
    const carry = !Number.isNaN(target);
    const block = this.blockOf(f, carry);
    this.lastBlock = block;
    if (block !== null) return;
    const zone = zoneIndexAt(this.zones, f.real);
    if (zone < 0 && !carry) {
      this.lastBlock = "outside";
      return;
    }
    if (!carry) {
      target = restFor(
        this.zones[zone]!,
        this.thresholds,
        f.real,
        this.lastDirDown,
        f.keyAt > f.pushAt,
      );
    }
    if (Number.isNaN(target) || Math.abs(target - f.real) < MIN_MOVE) {
      this.lastBlock = "no-rest";
      return;
    }
    this.movingTo = target;
    this.movingUntil = f.now + SNAP_SECONDS * 1000 + 700;
    if (carry && this.deps.carry) this.deps.carry(target, SNAP_SECONDS);
    else this.deps.move(target, SNAP_SECONDS);
  }

  /** Why nothing snaps now, from the facts of the frame. Cheap, no allocation. */
  private blockOf(f: SnapFrame, carry = false): SnapBlock | null {
    if (!f.open) return "closed";
    if (f.frozen) return "frozen";
    if (f.zoned && !carry) return "zone";
    const inputAt = Math.max(f.pushAt, f.keyAt);
    if (inputAt <= this.jumpAt) return "unarmed";
    if (f.now - this.jumpAt < SNAP_GRACE_MS) return "grace";
    if (!Number.isNaN(this.movingTo)) return "moving";
    if (f.scripted) return "script";
    if (f.touching) return "touch";
    if (f.now - Math.max(inputAt, this.movedAt) < SNAP_IDLE_MS) return "input";
    if (f.holds > 0 || f.locked) return "hold";
    if (f.playing) return "play";
    if (f.chasing) return "chase";
    return null;
  }

  /** The state for `window.__home.snap()`. Allocates: for a probe, not for a frame. */
  report(): SnapReport {
    const f = this.last;
    const real = this.lastReal;
    const zone = zoneIndexAt(this.zones, real);
    const target =
      zone >= 0
        ? restFor(
            this.zones[zone]!,
            this.thresholds,
            real,
            this.lastDirDown,
            f ? f.keyAt > f.pushAt : false,
          )
        : NaN;
    return {
      idleMs: f ? Math.round(f.now - Math.max(f.pushAt, f.keyAt, this.movedAt)) : 0,
      armed: f ? Math.max(f.pushAt, f.keyAt) > this.jumpAt : false,
      moving: !Number.isNaN(this.movingTo),
      blocked: this.lastBlock,
      zone: zone >= 0 ? this.zones[zone]! : null,
      target: Number.isNaN(target) ? null : target,
      zones: this.zones.length,
      joints: this.zones,
      thresholds: this.thresholds,
    };
  }
}
