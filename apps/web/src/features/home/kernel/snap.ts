/**
 * The page's snap: where the scroll comes to rest when the visitor lets go inside a joint, and how a
 * very hard flick is kept from skipping the scenes. Pure arithmetic and two small state machines; the
 * engine feeds them the frame's facts and does the moving.
 *
 * JOINT SNAP. A section with plays rests between two thresholds (a dwell): `update` gets a number that
 * does not follow the scroll there, so any position in a dwell is a rest. The places that are not rests
 * are the joints, where a section's lead or tail is on screen and follows the scroll (and the ground
 * cross-fades): two sections are on screen at once. When the visitor lets go inside a joint the page
 * runs on its own, in half a second, to the nearer rest: the end of the dwell of the section before,
 * or the start of the dwell of the one after. It never goes where a play would fire (a play is a scene,
 * not a place to rest), so a joint with a threshold in it snaps one way only.
 *
 * FLICK. The scene sees the scroll through `FlickLimiter`. A step of the real page larger than one
 * screen in one frame (a wheel flick of many thousand pixels, a slow frame) made the scene jump and
 * rest every play on the way. After a wheel or a touch such a step is taken one screen a frame, the
 * plays fire in order (each holds the page), and the page is pulled back so the chase is never longer
 * than `FLICK_MAX_LEAD` screens. A key (Home, End), a seek, a focus move and a script's move still jump.
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
    if (!p.def.plays) {
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
    for (const play of p.def.plays ?? []) out.push(p.start + play.at * p.def.screens);
  }
  return out.sort((a, b) => a - b);
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
  | "script";

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
  /** The scene is still catching up with the page (`FlickLimiter.engaged`). */
  chasing: boolean;
  /** A script's own move of the page is on its way (a button, a focus move), not ours. */
  scripted: boolean;
}

export interface SnapDeps {
  readonly layout: Layout;
  /** Run the page to a position in screens, smoothly, in `seconds`. */
  move(screens: number, seconds: number): void;
  /** Stop a smooth move that is on its way (the smooth scroller's own tween). */
  stop(): void;
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
      if (!Number.isNaN(this.refReal)) this.lastDirDown = f.real > this.refReal;
      this.refReal = f.real;
      this.movedAt = f.now;
    }
    this.lastReal = f.real;
    // Our own move: over when the page has arrived, or it has had its time.
    if (!Number.isNaN(this.movingTo)) {
      if (Math.abs(f.real - this.movingTo) < ARRIVED || f.now > this.movingUntil) {
        this.movingTo = NaN;
      }
    }
    const block = this.blockOf(f);
    this.lastBlock = block;
    if (block !== null) return;
    const zone = zoneIndexAt(this.zones, f.real);
    if (zone < 0) {
      this.lastBlock = "outside";
      return;
    }
    const target = restFor(
      this.zones[zone]!,
      this.thresholds,
      f.real,
      this.lastDirDown,
      f.keyAt > f.pushAt,
    );
    if (Number.isNaN(target) || Math.abs(target - f.real) < MIN_MOVE) {
      this.lastBlock = "no-rest";
      return;
    }
    this.movingTo = target;
    this.movingUntil = f.now + SNAP_SECONDS * 1000 + 700;
    this.deps.move(target, SNAP_SECONDS);
  }

  /** Why nothing snaps now, from the facts of the frame. Cheap, no allocation. */
  private blockOf(f: SnapFrame): SnapBlock | null {
    if (!f.open) return "closed";
    if (f.frozen) return "frozen";
    const inputAt = Math.max(f.pushAt, f.keyAt);
    if (inputAt <= this.jumpAt) return "unarmed";
    if (f.now - this.jumpAt < SNAP_GRACE_MS) return "grace";
    if (!Number.isNaN(this.movingTo)) return "moving";
    if (f.scripted) return "script";
    if (f.touching) return "touch";
    if (f.now - Math.max(inputAt, this.movedAt) < SNAP_IDLE_MS) return "input";
    if (f.holds > 0) return "hold";
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

// ---------------------------------------------------------------------------------------------------

/** A step of the real page larger than this many screens in one frame engages the limiter. */
export const FLICK_ENGAGE = 1;
/** While engaged, the scene follows the page at most this many screens a frame (under the jump of 1.5 less the lag of 0.2). */
export const FLICK_STEP = 1;
/** A wheel or a touch this recently (ms) makes a large step a flick; later it is a jump. */
export const FLICK_WINDOW_MS = 1500;
/** The scene is never more than this many screens behind the page: the rest of a flick is dropped. */
export const FLICK_MAX_LEAD = 2;
/** The longest a chase may last (ms): then the scene jumps to the page. */
const FLICK_GIVE_UP_MS = 20_000;

export interface FlickFrame {
  /** The real position of the page, screens. */
  real: number;
  now: number;
  /** A seek, a jump, a focus move, a script's move, a frozen scene: the scene takes the page as it is. */
  forced: boolean;
  /** A play holds the page. */
  holding: boolean;
  pushAt: number;
  keyAt: number;
}

/**
 * What the scene sees of the page's position. It is the real position, except when one frame's step is
 * larger than `FLICK_ENGAGE` screens after a wheel or a touch: then the scene takes it `FLICK_STEP` at a
 * time (standing still while a play holds the page), so every threshold on the way fires in order. The
 * page is pulled back (`pull`, screens) so that the scene is never more than `FLICK_MAX_LEAD` behind it.
 */
export class FlickLimiter {
  private seenValue = 0;
  private on = false;
  private since = 0;
  private primed = false;
  /** The position the engine must put the page at (screens), or NaN: written by `step`, read once. */
  pull = NaN;

  /** The position the scene sees. */
  get seen(): number {
    return this.seenValue;
  }

  /** The scene is behind the page and catching up. */
  get engaged(): boolean {
    return this.on;
  }

  /** The scene's position for this frame. */
  step(f: FlickFrame): number {
    this.pull = NaN;
    if (!this.primed || f.forced) {
      this.primed = true;
      this.on = false;
      this.seenValue = f.real;
      return f.real;
    }
    const diff = f.real - this.seenValue;
    if (!this.on) {
      const pushed = f.pushAt > 0 && f.pushAt >= f.keyAt && f.now - f.pushAt < FLICK_WINDOW_MS;
      if (Math.abs(diff) > FLICK_ENGAGE && pushed) {
        this.on = true;
        this.since = f.now;
      } else {
        this.seenValue = f.real;
        return f.real;
      }
    }
    // A key after the flick, or too long a chase: the scene jumps to the page.
    if (f.keyAt > f.pushAt || f.now - this.since > FLICK_GIVE_UP_MS) {
      this.on = false;
      this.seenValue = f.real;
      return f.real;
    }
    // The page is never more than FLICK_MAX_LEAD ahead of the scene: the rest of the flick is dropped.
    let goal = f.real;
    if (Math.abs(diff) > FLICK_MAX_LEAD) {
      goal = this.seenValue + Math.sign(diff) * FLICK_MAX_LEAD;
      this.pull = goal;
    }
    if (!f.holding) {
      this.seenValue += Math.max(-FLICK_STEP, Math.min(FLICK_STEP, goal - this.seenValue));
    }
    if (Math.abs(goal - this.seenValue) < 1e-4 && Number.isNaN(this.pull)) this.on = false;
    return this.seenValue;
  }
}
