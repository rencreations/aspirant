/**
 * The geometry and the motion of the disc field, as plain numbers (no three.js), so it can be
 * tested. The engine (`engine.ts`) reads it every frame.
 *
 * Words used here:
 *  - `pos` is where the field stands: a real number of discs, without end. The disc in front is
 *    the one whose slot is `Math.round(pos)`.
 *  - A slot is a whole number. Slot `k` shows track `mod(k, count)`, so walking past the last track
 *    brings the first back, and walking back past the first brings the last.
 *  - `m` is the offset of a slot from `pos` (`k - pos`), negative for the discs before the front.
 */

/** The field on a wide screen: discs on an arc, seen from above and to the side. */
export const FIELD = {
  /** The tilt of the whole field, in radians (about 30 degrees down and 30 to the side). */
  tiltX: -Math.PI / 6,
  tiltY: -Math.PI / 6,
  scale: 1.08,
  fov: 40,
  cameraZ: 4.4,
  /** The angle between two neighbours on the arc. */
  arcStep: 0.35,
  /** Radius of the arc along the field, and how far it curves towards the viewer. */
  arcReach: 5.52,
  arcDepth: 2.4,
  /** The disc in front rises a little. */
  frontLift: 0.06,
  /** Discs away from the front shrink by this much for each step, down to `sideScale`. */
  shrinkPerStep: 0.12,
  sideScale: 0.8,
  /** Discs drawn on each side of the front (beyond this they are off screen). */
  reach: 4,
  /**
   * The field sits a little right of and below the middle of the screen, so the disc before the
   * front stays clear of the words at the top left. Shares of the screen's width and height.
   */
  shiftX: 0.05,
  shiftY: 0.075,
  /** The field has its full size on screens this tall (CSS px) or taller; shorter, down to `minFit`. */
  fullHeight: 900,
  minFit: 0.88,
} as const;

/** The field on a narrow screen: a row across the screen that drops and recedes on the sides. */
export const ROW = {
  gap: 2.2,
  drop: 1,
  depth: 0.5,
  frontScale: 1.5,
  sideScale: 0.6,
  /** The neighbours' centres sit this far out, in screen halves (1 is the edge of the screen). */
  peek: 1,
  /** The disc in front is at most this tall, in screen halves. */
  maxHeight: 0.6,
  /** Narrower than this (CSS px) the field is a row. */
  maxWidth: 991,
  /** The row sits a little below the middle, between the words and the player. */
  shiftY: 0.035,
} as const;

/** How the field leans when it moves, from its speed in discs a second. */
const FLOW = {
  lean: 0.055,
  leanMax: 0.3,
  bank: 0.32,
  dip: 0.014,
  dipMax: 0.09,
} as const;

/** How quickly a disc catches up with its place (per second), nearer discs faster. */
export const FOLLOW = {
  base: 11,
  tight: 15,
  falloff: 1.15,
  min: 6.5,
} as const;

export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
}

/** `i` modulo `n`, never negative. */
export function mod(i: number, n: number): number {
  if (n <= 0) return 0;
  return ((i % n) + n) % n;
}

/** The track shown by a slot. */
export function trackOf(slot: number, count: number): number {
  return mod(slot, count);
}

/** The slot in front. */
export function frontSlot(pos: number): number {
  return Math.round(pos);
}

/** The slots drawn around `pos`, lowest first. */
export function slotsAround(pos: number, reach: number = FIELD.reach): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(pos - reach) + 0; k <= Math.floor(pos + reach); k += 1) out.push(k);
  return out;
}

/**
 * The slot that shows `track` nearest to `pos`, so a jump takes the short way round the loop
 * (from the last track to the first is one step forward, not eight back).
 */
export function nearestSlot(pos: number, track: number, count: number): number {
  const base = Math.round(pos);
  const delta = mod(track - base, count);
  const forward = base + delta;
  const back = forward - count;
  return Math.abs(forward - pos) <= Math.abs(back - pos) ? forward : back;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The lean of the field (radians) from its smoothed speed. */
export function leanOf(flow: number): number {
  return clamp(
    Math.sign(flow) * Math.sqrt(Math.abs(flow)) * FLOW.lean,
    -FLOW.leanMax,
    FLOW.leanMax,
  );
}

/** How far the field dips while it moves. */
export function dipOf(flow: number): number {
  return Math.min(FLOW.dipMax, Math.abs(flow) * FLOW.dip);
}

/** The place of a disc `m` steps from the front on a wide screen, in the field's own frame. */
export function arcPose(m: number, front: boolean, flow: number): Pose {
  const a = m * FIELD.arcStep;
  const lean = leanOf(flow);
  const dip = dipOf(flow);
  const dist = Math.abs(m);
  return {
    x: Math.sin(a) * FIELD.arcReach,
    y: (front ? FIELD.frontLift : 0) - dip * (front ? 0.7 : 1),
    z: FIELD.arcDepth * (1 - Math.cos(a)),
    rx: 0,
    ry: -a + lean * (front ? 1 : 1.12),
    rz: -lean * FLOW.bank * (front ? 0.7 : 1),
    scale: front ? 1 : Math.max(FIELD.sideScale, 1 - dist * FIELD.shrinkPerStep),
  };
}

/**
 * The place of a disc on a narrow screen. `x`, `y` and `z` are in screen-aligned units (the
 * engine turns them back into the field's frame); the turn is in the field's frame. Discs on the
 * left turn to face the other way, like the left page of an open book.
 */
export function rowPose(m: number, front: boolean, flow: number): Pose {
  const lean = leanOf(flow);
  const dip = dipOf(flow);
  const d = Math.min(Math.abs(m), 2.5);
  return {
    x: m * ROW.gap,
    y: -d * ROW.drop + (front ? FIELD.frontLift : 0) - dip * (front ? 0.7 : 1),
    z: -d * ROW.depth,
    rx: 0,
    ry: clamp(-m, 0, 1) * -2 * FIELD.tiltY + lean * (front ? 1 : 1.12),
    rz: -lean * FLOW.bank * (front ? 0.7 : 1),
    scale: front ? ROW.frontScale : Math.max(ROW.sideScale, 1 - Math.abs(m) * (1 - ROW.sideScale)),
  };
}

/** The share of the way a disc closes on its place in `dt` seconds. Far discs trail behind. */
export function followShare(dist: number, dt: number, tight: boolean): number {
  const rate = clamp(
    (tight ? FOLLOW.tight : FOLLOW.base) - dist * FOLLOW.falloff,
    FOLLOW.min,
    FOLLOW.tight,
  );
  return Math.min(1, dt * rate);
}

export type GlideSource = "wheel" | "key" | "click" | "flick" | "snap";

/** How long a glide to a disc `dist` steps away lasts, and how hard it pushes the lean. */
export function glideFor(source: GlideSource, dist: number): { duration: number; kick: number } {
  const base = 0.46;
  switch (source) {
    case "wheel":
      return { duration: base + 0.05, kick: 2.5 };
    case "key":
      return { duration: Math.min(0.6, base - 0.04 + dist * 0.05), kick: 4 };
    case "click":
      return { duration: clamp(0.45 + dist * 0.11, base, 1.05), kick: Math.min(5, dist * 1.4) };
    case "flick":
      return { duration: base + 0.1, kick: 0 };
    default:
      return { duration: base, kick: 0 };
  }
}

/**
 * A CSS style cubic Bezier easing (`cubic-bezier(x1, y1, x2, y2)`) as a function of time 0 to 1.
 * Newton steps with a bisection fallback.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i += 1) {
      const err = sx(u) - t;
      if (Math.abs(err) < 1e-6) return sy(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0;
    let hi = 1;
    u = t;
    for (let i = 0; i < 30; i += 1) {
      const x = sx(u);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

/** The glide of the field: quick out of the start, long soft landing. */
export const glideEase = cubicBezier(0.32, 0.72, 0, 1);

export const easeOutCubic = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeInQuad = (t: number): number => clamp(t, 0, 1) ** 2;

/**
 * How far a disc that is not in front has come in, during the entrance: the discs near the front
 * arrive first. `others` runs 0 to 1 over the entrance; the result is 0 to 1.
 */
export function arrival(others: number, dist: number): number {
  const stagger = 0.28;
  const steps = 4;
  const delay = (Math.min(dist, steps) / steps) * stagger;
  const t = clamp((Math.min(1, others) - delay) / Math.max(0.1, 1 - stagger), 0, 1);
  return glideEase(t);
}
