/**
 * The floating previews, after Psychoactive's "ambitious brands" hold (digest 1.7): a comet-like
 * train of cards on an ellipse. The trailer is card 0, the leader, and the ten previews follow it.
 * Pure functions of the viewport and a few numbers; nothing here allocates per call.
 *
 * Two ways in, both reversible:
 *  - `dolly` (the reference): the whole orbit is there from the first moment, scaled and shifted so
 *    that card 0 coincides with the trailer's frame, and the camera pulls back until the cards read
 *    at their own size. The width goes by a logarithm and the place by a matching fraction, so the
 *    zoom looks steady.
 *  - `gather` (the owner's "they appear from the slit"): the cards are at their own size, and each
 *    leaves the trailer's frame along an arc to its place, one after another.
 */
import { clamp, mix, ramp, smootherstep } from "../image-field/math";
import { orbitCardWidth, orbitStage, sceneCentre } from "./layout";
import { PLANE_COUNT, type PlanePose, type Vp } from "./types";
import { PREVIEW_ASPECT } from "./data";

/** The train: a geometric series of gaps (ratio 0.88) over 0.62 of a turn. */
const GAP_RATIO = 0.88;
const SPAN = 0.62 * 2 * Math.PI;
/** The leader of a train this long stands at 1.25 of a card, the tail at 0.4. */
const LEAD_SCALE = 1.25;
const TAIL_SCALE = 0.4;
/** Where the leader stands when the orbit has not turned (angle of the ellipse, y down: bottom right). */
export const ORBIT_START = 0.93;
/** The orbit's slow drift, radians a second (about five degrees). */
export const ORBIT_DRIFT = 0.09;

/** The angular gap before each card of the train, cumulative from the leader. */
export function trainAngles(n: number, out: Float64Array): Float64Array {
  const first = (SPAN * (1 - GAP_RATIO)) / (1 - Math.pow(GAP_RATIO, n - 1));
  let acc = 0;
  for (let i = 0; i < n; i++) {
    out[i] = acc;
    acc += first * Math.pow(GAP_RATIO, i);
  }
  return out;
}

/** Where a card stands in the train: 0 the leader (card 0, the trailer) to 1 the tail. */
export function trainPlace(card: number): number {
  const n = PLANE_COUNT;
  return ((n - card) % n) / (n - 1);
}

/** One card's place in the orbit, before the dolly: offsets from the stage's centre in CSS px (y down). */
export interface OrbitSlot {
  x: number;
  y: number;
  /** Scale against the card's own size. */
  s: number;
  /** 0 to 1, the back of the ellipse to the front. */
  front: number;
  /** Opacity of the place in the train. */
  o: number;
  /** Place in the train, 0 the leader to 1 the tail. */
  a: number;
}

export function makeSlots(): OrbitSlot[] {
  return Array.from({ length: PLANE_COUNT }, () => ({ x: 0, y: 0, s: 1, front: 0, o: 1, a: 0 }));
}

const gaps = new Float64Array(PLANE_COUNT);

/** The size of a card of the orbit and the ellipse it runs on, for a viewport. */
export function orbitMetrics(vp: Vp): { cardW: number; cardH: number; rx: number; ry: number } {
  const cardW = orbitCardWidth(vp.w, vp.h);
  const cardH = cardW / PREVIEW_ASPECT;
  const stage = orbitStage(vp.w, vp.h);
  return {
    cardW,
    cardH,
    rx: Math.max(10, stage.w / 2 - cardW * 0.425),
    ry: Math.max(10, stage.h / 2 - cardH * 0.5),
  };
}

/** The slots of the train at a turn `R` (radians). Card 0 is the leader, card `e` has rank `(n - e) mod n`. */
export function orbitSlots(vp: Vp, R: number, out: OrbitSlot[]): OrbitSlot[] {
  const n = PLANE_COUNT;
  const { rx, ry } = orbitMetrics(vp);
  trainAngles(n, gaps);
  for (let e = 0; e < n; e++) {
    const i = (n - e) % n;
    const a = i / (n - 1);
    const o = R - gaps[i]!;
    const s01 = (Math.sin(o) + 1) / 2;
    const slot = out[e]!;
    slot.x = Math.cos(o) * rx;
    slot.y = Math.sin(o) * ry;
    slot.s = LEAD_SCALE * Math.pow(TAIL_SCALE / LEAD_SCALE, a) * (0.82 + 0.18 * s01);
    slot.front = s01;
    slot.o = (1 - (1 - 0.22) * Math.pow(a, 0.85)) * (0.65 + 0.35 * s01);
    slot.a = a;
  }
  return out;
}

const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const slots = makeSlots();

/** The orbit's own corner radius for a card of height `h`. */
function cardCorner(h: number): number {
  return 0.05 * h;
}

/**
 * Write the pose of every plane for a pull `pull` (0 the trailer's own frame, 1 the orbit at rest).
 * `base` is the trailer's pose at pull 0 (its frame, in the stage's frame). `R` is the orbit's turn.
 * The trailer (plane 0) ends as card 0. The previews have opacity 0 at pull 0.
 */
export function orbitPoses(
  vp: Vp,
  mode: "dolly" | "gather",
  pull: number,
  R: number,
  base: PlanePose,
  out: PlanePose[],
): void {
  const c = clamp(pull);
  orbitSlots(vp, R, slots);
  const { cardW } = orbitMetrics(vp);
  const centre = sceneCentre(vp.w, vp.h);
  const cx = centre.x - vp.w / 2;
  const cy = vp.h / 2 - centre.y;

  const s0 = slots[0]!;
  const t0w = cardW * s0.s;
  const t0x = cx + s0.x;
  const t0y = cy - s0.y;

  // The trailer's frame goes to the leader's place; the width by a logarithm, the place by a matching fraction.
  const ease = easeInOutQuad(c);
  const ratio = t0w / Math.max(1, base.w);
  const wi = base.w * Math.pow(ratio, ease);
  const along = Math.abs(ratio - 1) < 1e-4 ? ease : (wi / base.w - 1) / (ratio - 1);
  const hx = base.x + along * (t0x - base.x);
  const hy = base.y + along * (t0y - base.y);
  const baseAspect = base.w / Math.max(1, base.h);
  const hAspect = mix(baseAspect, PREVIEW_ASPECT, ease);

  const hero = out[0]!;
  hero.x = hx;
  hero.y = hy;
  hero.z = base.z;
  hero.q[0] = base.q[0];
  hero.q[1] = base.q[1];
  hero.q[2] = base.q[2];
  hero.q[3] = base.q[3];
  hero.w = wi;
  hero.h = wi / hAspect;
  hero.corner = mix(base.corner, cardCorner(hero.h), ease);
  hero.opacity = mix(base.opacity, s0.o, ease);
  hero.order = 50 + Math.round(100 * s0.front);
  hero.bend = 0;
  hero.flutter = 0;

  const Z = mode === "dolly" ? wi / t0w : 1;
  for (let k = 1; k < PLANE_COUNT; k++) {
    const slot = slots[k]!;
    const p = out[k]!;
    const w = cardW * slot.s * (mode === "dolly" ? Z : 1);
    p.q[0] = p.q[1] = p.q[2] = 0;
    p.q[3] = 1;
    p.z = 0;
    p.order = 50 + Math.round(100 * slot.front);
    p.bend = 0;
    p.flutter = 0;
    if (mode === "dolly") {
      p.x = hx + (slot.x - s0.x) * Z;
      p.y = hy - (slot.y - s0.y) * Z;
      p.w = w;
      p.h = w / PREVIEW_ASPECT;
      p.opacity = slot.o * smootherstep(ramp(c, 0, 0.2));
      p.corner = cardCorner(p.h);
    } else {
      // Each card leaves the frame at its own time, the head of the train first, along an arc, growing as it goes.
      const wait = slot.a * 0.45;
      const g = clamp((c - wait) / 0.55);
      const e = easeOutCubic(g);
      const tx = cx + slot.x;
      const ty = cy - slot.y;
      const arc = Math.sin(Math.PI * g) * 0.22 * Math.hypot(tx - hx, ty - hy);
      const dx = tx - hx;
      const dy = ty - hy;
      const len = Math.hypot(dx, dy) || 1;
      p.x = hx + dx * e + (-dy / len) * arc * (k % 2 === 0 ? 1 : -1);
      p.y = hy + dy * e + (dx / len) * arc * (k % 2 === 0 ? 1 : -1);
      const grown = mix(0.18, 1, e);
      p.w = w * grown;
      p.h = p.w / PREVIEW_ASPECT;
      p.opacity = slot.o * smootherstep(ramp(g, 0, 0.35));
      p.corner = cardCorner(p.h);
    }
  }
}
