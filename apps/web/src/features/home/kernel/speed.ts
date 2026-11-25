/**
 * The scene's top speed (24 and 25 Nov 2026, the owner: "when user scroll really really fast, I wanted
 * the page to move fast according to user intention to scroll fast, but all animations must NOT be
 * broken"). Everything the visitor sees is drawn from the scene's position, not the page's: the words,
 * the frames and the cast are fixed layers that follow `S`. So the scene is what is held to a speed,
 * everywhere: free ground at `FREE_SPEED`, every scroll zone at `AUTO_ZONE_SPEED`, and the passages a
 * section names (`HomeSection.topSpeed`) at their own. However hard the visitor scrolls, every fade,
 * every pose and every reveal on the way is drawn at least over several frames: nothing vanishes in
 * one, and the scene never leaps to catch the page up.
 *
 * The page is not allowed to run far ahead of the scene (`SceneGovernor.pull`): when the visitor's own
 * wheel or touch has carried it further than the lead (`leadAt`), it is put back. When they let go the
 * scene finishes the little that is left, and a turn of the wheel turns the scene at once. A long move
 * that the visitor did not make with a wheel or a touch (Home or End, Back, a script) is a jump and
 * lands at once; a seek and a focus move are forced.
 *
 * Pure arithmetic: the engine feeds it the page's position and gets the scene's. No DOM, no three.
 */

/** The top speed of the scene on free ground (screens a second). A brisk wheel is one to two. */
export const FREE_SPEED = 3.5;

/**
 * The top speed of every scroll zone of the page (the owner, 25 Nov 2026: scrolling too fast makes the
 * models and their animations weird). A section that needs a slower pass says so in its own
 * `topSpeed`, and the lower speed wins where two meet.
 */
export const AUTO_ZONE_SPEED = 1.5;

/** The speed of Selena's growth into the screen and her way out (her film), screens a second. */
export const SELENA_SPEED = 0.82;

/**
 * The top speed of a whole passage whose scenes follow one another closely (the character list,
 * Selena's section, the voices' first screens): the rests between their zones too.
 */
export const PASSAGE_SPEED = 2;

/**
 * The top speed of the lower passages, the funny scene to the archive, rests included (25 Nov 2026):
 * their cast is big on the screen and a hard scroll must not run the poses, the runs and the words
 * past the eye. The zones inside them have their own, lower, speeds.
 */
export const LOWER_PASSAGE_SPEED = 1.5;

/** How long (seconds) the scene may be behind the page: the lead is this much of the local speed. */
const LEAD_SECONDS = 0.6;
/** The lead never falls under this (screens), so a slow passage still answers the wheel at once. */
const LEAD_MIN = 0.3;
/** Nor rises over this. */
const LEAD_MAX = 1.2;
/** A move of the page longer than this (screens) that no wheel or touch made is a jump. */
const JUMP_GAP = 2.5;

/** A passage in absolute screens. */
export interface SpeedRange {
  readonly start: number;
  readonly end: number;
  readonly speed: number;
}

/**
 * Ranges that may overlap (a section's own stretches, the zones of the next section, Selena's) made
 * into a list that is sorted, apart, and has the lowest speed wherever two meet.
 */
export function normalizeRanges(list: readonly SpeedRange[]): SpeedRange[] {
  const points = [...new Set(list.flatMap((r) => [r.start, r.end]))].sort((a, b) => a - b);
  const out: SpeedRange[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    let speed = Infinity;
    for (const r of list) if (r.start <= a && r.end >= b) speed = Math.min(speed, r.speed);
    if (!Number.isFinite(speed)) continue;
    const last = out[out.length - 1];
    if (last?.end === a && last.speed === speed) {
      out[out.length - 1] = { start: last.start, end: b, speed };
    } else {
      out.push({ start: a, end: b, speed });
    }
  }
  return out;
}

/**
 * The speed at `s` for a move in the given direction, and where that speed ends (the next edge in the
 * way of the move). The ranges are normalized: sorted and apart. Between them the speed is `free`.
 */
function stretchAt(
  s: number,
  down: boolean,
  ranges: readonly SpeedRange[],
  free: number,
): { speed: number; edge: number } {
  if (down) {
    for (const r of ranges) {
      if (s < r.start) return { speed: free, edge: r.start };
      if (s < r.end) return { speed: r.speed, edge: r.end };
    }
    return { speed: free, edge: Infinity };
  }
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i]!;
    if (s > r.end) return { speed: free, edge: r.end };
    if (s > r.start) return { speed: r.speed, edge: r.start };
  }
  return { speed: free, edge: -Infinity };
}

/** The top speed at `s` (the lower one when `s` is an edge). */
export function speedAt(s: number, ranges: readonly SpeedRange[], free = FREE_SPEED): number {
  return Math.min(stretchAt(s, true, ranges, free).speed, stretchAt(s, false, ranges, free).speed);
}

/**
 * Where the scene may go this frame: from `scene` toward `ask`, for `dt` seconds, at the speed of
 * each stretch it crosses (`free` between the ranges). It never passes `ask` and never moves against it.
 */
export function limitSpeed(
  scene: number,
  ask: number,
  dt: number,
  ranges: readonly SpeedRange[],
  free = FREE_SPEED,
): number {
  if (!(dt > 0) || ask === scene) return ask;
  const down = ask > scene;
  let at = scene;
  let budget = dt;
  // A move can cross several stretches: walk it from one to the next.
  for (let guard = 0; guard < 64 && budget > 1e-9; guard++) {
    const left = Math.abs(ask - at);
    if (left < 1e-9) return ask;
    const { speed, edge } = stretchAt(at, down, ranges, free);
    const toEdge = Math.abs(edge - at);
    const reach = speed * budget;
    const used = Math.min(left, toEdge);
    if (reach < used) return down ? at + reach : at - reach;
    budget -= used / speed;
    at = down ? at + used : at - used;
    if (used === left) return ask;
  }
  return at;
}

/** How far (screens) the page may run ahead of the scene at `s`: about `LEAD_SECONDS` of its speed. */
export function leadAt(s: number, ranges: readonly SpeedRange[], free = FREE_SPEED): number {
  return Math.min(LEAD_MAX, Math.max(LEAD_MIN, speedAt(s, ranges, free) * LEAD_SECONDS));
}

export interface GovernFrame {
  /** The page's real position, screens. */
  real: number;
  /** The frame's seconds. */
  dt: number;
  /** A seek, a focus move, a frozen scene, the first frame: the scene takes the page as it is. */
  forced: boolean;
  /** A clock play holds the page: the scene stands where it is. */
  holding: boolean;
  /**
   * The page is moving because of the visitor's own wheel or touch (and its glide). Only then is it
   * put back when it leads; any other move (a key, a script, a snap) is followed or, when long, jumped.
   */
  visitor: boolean;
}

/**
 * The scene's view of the page's position, held to the top speed of each stretch, with the page put
 * back (`pull`, screens) when the visitor has carried it further ahead than `leadAt`.
 */
export class SceneGovernor {
  private seenValue = 0;
  private primed = false;
  /** Where the engine must put the page this frame (screens), or NaN: written by `step`. */
  pull = Number.NaN;

  constructor(
    private readonly ranges: readonly SpeedRange[],
    private readonly free = FREE_SPEED,
  ) {}

  /** Where the scene is. */
  get seen(): number {
    return this.seenValue;
  }

  /** The lead allowed where the scene is now. */
  lead(): number {
    return leadAt(this.seenValue, this.ranges, this.free);
  }

  /** The scene's position for this frame. */
  step(f: GovernFrame): number {
    this.pull = Number.NaN;
    if (!this.primed || f.forced) {
      this.primed = true;
      this.seenValue = f.real;
      return f.real;
    }
    const gap = f.real - this.seenValue;
    // A long move that is not the visitor's scroll (Home, End, Back, a script that left its zone): a
    // jump. The sections that were passed run once at their end (the run rule).
    if (!f.visitor && Math.abs(gap) > JUMP_GAP) {
      this.seenValue = f.real;
      return f.real;
    }
    if (!f.holding) {
      this.seenValue = limitSpeed(this.seenValue, f.real, f.dt, this.ranges, this.free);
    }
    if (f.visitor) {
      const lead = this.lead();
      const ahead = f.real - this.seenValue;
      if (Math.abs(ahead) > lead) this.pull = this.seenValue + Math.sign(ahead) * lead;
    }
    return this.seenValue;
  }
}
