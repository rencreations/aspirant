/**
 * Scroll zones and their idle snap (K7, round three). Pure arithmetic and one small state machine; the
 * engine feeds the machine the frame's facts and does the moving.
 *
 * A ZONE is a play with a `span` (`kernel/plays.ts`): while the scroll is inside `[at, at + span]` of
 * the section, its value is `from + (to - from) * ease(p)`. There is no clock and no hold: the visitor
 * drives it, up and down, and it is the same going either way. The value is a pure function of the
 * scene's scroll (`zoneValue`), so a frame sheet that seeks into a zone gets the same picture as a slow
 * scroll. A section may mix zones and clock plays.
 *
 * IDLE SNAP. A visitor who stops in the middle of a zone is not left there: after `ZONE_IDLE_MS` with no
 * input, no clock play, no hold and no script move, the page runs by itself to the end of the zone the
 * visitor was heading to (down: forward from a quarter of it, else back; up: back up to three quarters,
 * else forward). A key always finishes the way it went. It moves with the engine's own script move
 * (`ScrollApi.to`, which rests clock plays instead of firing them), eased in and out, and any new input
 * cancels it at once. It never runs in a dwell (between zones the scroll is free), never within 600 ms
 * of a seek or the load, and never before the visitor has pushed the page.
 *
 * Units: screens (the scroll in `unit` pixels), milliseconds on the wall clock for time.
 * `docs/design/home/kernel-scrub.md` says how to author and how to look at it.
 */
import type { Layout } from "./layout";
import type { SnapBlock, SnapDeps, SnapFrame } from "./snap";
import type { SectionId } from "./types";

/** The scroll has to be still, and nobody pushing, this long before the page finishes a zone. */
export const ZONE_IDLE_MS = 220;
/** No snap this soon after a seek, a jump or the load. */
export const ZONE_GRACE_MS = 600;
/** The shortest move to a zone's end, in seconds. */
export const ZONE_MIN_SECONDS = 0.35;
/** Inside this share of a zone's length from either end the page counts as at rest there. */
export const ZONE_EDGE = 0.02;
/** Going down, the zone is finished forward from this share of it; below it goes back. */
const ZONE_FORWARD_DOWN = 0.25;
/** Going up, the zone goes back up to this share of it; above it is finished forward. */
const ZONE_BACK_UP = 0.75;
/** The scroll moves this many pixels or more: it is still moving. */
const MOVE_EPS_PX = 1.5;
/** The move is over when the page is this near (screens) its target. */
const ARRIVED = 0.004;

/** A zone placed on the page. All numbers in screens from the top. */
export interface ZoneRange {
  readonly id: SectionId;
  /** The index of the play in the section's table. */
  readonly index: number;
  readonly from: number;
  readonly to: number;
  /** The length of the snap for the full traverse (`seconds` of the play). */
  readonly seconds: number;
  /** False for a zone flagged `noSnap`: the page is never finished by itself inside it. */
  readonly snap: boolean;
}

/** Every zone of the page, in scroll order. */
export function zoneRanges(layout: Layout): ZoneRange[] {
  const out: ZoneRange[] = [];
  for (const p of layout.placed) {
    p.def.plays?.forEach((play, index) => {
      if (play.span === undefined) return;
      out.push({
        id: p.id,
        index,
        from: p.start + play.at * p.def.screens,
        to: p.start + (play.at + play.span) * p.def.screens,
        seconds: play.seconds,
        snap: play.noSnap !== true,
      });
    });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** How far through a zone the real scroll is, 0 to 1 unclamped (below 0 before it, above 1 after it). */
function rangeProgress(z: ZoneRange, s: number): number {
  const length = z.to - z.from;
  return length > 0 ? (s - z.from) / length : s >= z.from ? 1 : 0;
}

/**
 * The index of the zone the position is inside, or -1. With `edge` (a share of the zone's length) the
 * ends count as outside: the snap uses `ZONE_EDGE`, so a landing a pixel off an end is a rest.
 */
export function zoneIndexAt(zones: readonly ZoneRange[], s: number, edge = 0): number {
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]!;
    const p = rangeProgress(z, s);
    if (p > edge && p < 1 - edge) return i;
    if (s < z.from) break;
  }
  return -1;
}

export type ZoneHeading = "forward" | "back";

/**
 * Which end of the zone the page finishes at. `down` is the way the visitor last moved the page. With
 * `commit` (the last input was a key, which moves a few tens of pixels at a time) the way of travel
 * always wins, so a key can never be pulled back to where it started.
 */
export function zoneHeading(p: number, down: boolean, commit = false): ZoneHeading {
  if (commit) return down ? "forward" : "back";
  if (down) return p >= ZONE_FORWARD_DOWN ? "forward" : "back";
  return p <= ZONE_BACK_UP ? "back" : "forward";
}

/** What the snap does from a position inside a zone: where to, and how long it takes. */
export interface ZonePlan {
  readonly heading: ZoneHeading;
  /** Screens from the top. */
  readonly target: number;
  /** Seconds: the zone's `seconds` times the share of the zone left to travel, at least `ZONE_MIN_SECONDS`. */
  readonly seconds: number;
}

export function zonePlan(z: ZoneRange, s: number, down: boolean, commit = false): ZonePlan {
  const length = Math.max(1e-9, z.to - z.from);
  const heading = zoneHeading(
    rangeProgress(z, s),
    down,
    commit || (z.id === "selena" && z.index === 1),
  );
  const target = heading === "forward" ? z.to : z.from;
  const left = Math.min(1, Math.abs(target - s) / length);
  return { heading, target, seconds: Math.max(ZONE_MIN_SECONDS, z.seconds * left) };
}

/** What `window.__home.snap().scrub` says. */
export interface ScrubReport {
  readonly idleMs: number;
  readonly armed: boolean;
  readonly moving: boolean;
  readonly blocked: SnapBlock | null;
  /** The zone the page is inside (any part of it), with the real scroll's progress, or null. */
  readonly zone: (ZoneRange & { readonly p: number }) | null;
  /** Where the snap would run to from here, or null. */
  readonly target: number | null;
  readonly heading: ZoneHeading | null;
  readonly zones: readonly ZoneRange[];
}

/**
 * The idle snap of the zones. `step` once a frame, after the plays (the engine feeds it the same
 * `SnapFrame` as the joint snap). Any input after it started cancels it (`cancel`).
 */
export class ZoneSnap {
  private readonly zones: ZoneRange[];
  private jumpAt: number;
  private refReal = NaN;
  private movedAt = 0;
  private movingTo = NaN;
  private movingUntil = 0;
  private lastReal = 0;
  private lastDown = true;
  private last: SnapFrame | null = null;
  private lastBlock: SnapBlock | null = "closed";

  constructor(
    private readonly deps: SnapDeps,
    now: number,
  ) {
    this.zones = zoneRanges(deps.layout);
    this.jumpAt = now;
  }

  /** The page has zones at all (the engine skips the rest when it has none). */
  get any(): boolean {
    return this.zones.length > 0;
  }

  /** A snap of ours is on its way. */
  get moving(): boolean {
    return !Number.isNaN(this.movingTo);
  }

  /** The real scroll (screens) is strictly inside a zone: the joint snap leaves the page alone. */
  inside(real: number): boolean {
    return zoneIndexAt(this.zones, real) >= 0;
  }

  /** A seek, a jump, a focus move, a script's move or the load: no snap for a while, and none until the visitor pushes again. */
  noteJump(now: number): void {
    this.jumpAt = now;
    this.movingTo = NaN;
  }

  /** The visitor pushed the page: a snap on its way is over. `keys` also stops the smooth move. */
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
      if (!Number.isNaN(this.refReal)) this.lastDown = f.real > this.refReal;
      this.refReal = f.real;
      this.movedAt = f.now;
    }
    this.lastReal = f.real;
    if (!Number.isNaN(this.movingTo)) {
      if (Math.abs(f.real - this.movingTo) < ARRIVED || f.now > this.movingUntil) {
        this.movingTo = NaN;
      }
    }
    if (this.zones.length === 0) {
      this.lastBlock = "outside";
      return;
    }
    const block = this.blockOf(f);
    this.lastBlock = block;
    if (block !== null) return;
    const i = zoneIndexAt(this.zones, f.real, ZONE_EDGE);
    if (i < 0) {
      this.lastBlock = "outside";
      return;
    }
    // A zone flagged `noSnap` is a plain scroll linked passage: still a zone for the joint snap (it
    // keeps out), but the page is left where the visitor stops.
    if (!this.zones[i]!.snap) {
      this.lastBlock = "free";
      return;
    }
    const plan = zonePlan(this.zones[i]!, f.real, this.lastDown, f.keyAt > f.pushAt);
    if (Math.abs(plan.target - f.real) < 1e-4) {
      this.lastBlock = "no-rest";
      return;
    }
    this.movingTo = plan.target;
    this.movingUntil = f.now + plan.seconds * 1000 + 700;
    this.deps.move(plan.target, plan.seconds);
  }

  /** Why nothing snaps now, from the facts of the frame. Cheap, no allocation. */
  private blockOf(f: SnapFrame): SnapBlock | null {
    if (!f.open) return "closed";
    if (f.frozen) return "frozen";
    const inputAt = Math.max(f.pushAt, f.keyAt);
    if (inputAt <= this.jumpAt) return "unarmed";
    if (f.now - this.jumpAt < ZONE_GRACE_MS) return "grace";
    if (!Number.isNaN(this.movingTo)) return "moving";
    if (f.scripted) return "script";
    if (f.touching) return "touch";
    if (f.now - Math.max(inputAt, this.movedAt) < ZONE_IDLE_MS) return "input";
    if (f.holds > 0 || f.locked) return "hold";
    if (f.playing) return "play";
    if (f.chasing) return "chase";
    return null;
  }

  /** The state for `window.__home.snap().scrub`. Allocates: for a probe, not for a frame. */
  report(): ScrubReport {
    const f = this.last;
    const real = this.lastReal;
    const i = zoneIndexAt(this.zones, real);
    const z = i >= 0 ? this.zones[i]! : null;
    const plan = z ? zonePlan(z, real, this.lastDown, f ? f.keyAt > f.pushAt : false) : null;
    return {
      idleMs: f ? Math.round(f.now - Math.max(f.pushAt, f.keyAt, this.movedAt)) : 0,
      armed: f ? Math.max(f.pushAt, f.keyAt) > this.jumpAt : false,
      moving: !Number.isNaN(this.movingTo),
      blocked: this.lastBlock,
      zone: z ? { ...z, p: rangeProgress(z, real) } : null,
      target: plan ? plan.target : null,
      heading: plan ? plan.heading : null,
      zones: this.zones,
    };
  }
}
