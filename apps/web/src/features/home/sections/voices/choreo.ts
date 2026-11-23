/**
 * The arithmetic of the voices section: when each part emerges and leaves along the scroll, and
 * where the two Guinevere drones are. Pure: no DOM, no three. `local` is 0 at the start of the
 * section and 1 at its end; it runs a little outside that in the section's lead and tail.
 *
 * Joints (design 4.1): at `local` 0 the drones stand off screen at the two side edges (J9), at
 * `local` 1 they stand in the two bottom corners (J10) and the list has faded.
 */

import { REST_V } from "./stations";

export const ramp = (v: number, a: number, b: number): number =>
  Math.min(1, Math.max(0, (v - a) / (b - a)));

export const smooth = (u: number): number => u * u * (3 - 2 * u);

/**
 * `local` is the plays' value (`stations.ts`): the art arrives and the list fills in over this
 * stretch, and everything stands from `REST_V` until the leave starts.
 */
const IN_FROM = 0.015;
const IN_TO = 0.2;
/** The list fades and the art leaves over this stretch. */
export const OUT_FROM = REST_V + 0.04;
const OUT_TO = 1;

/** How far each stagger step waits, as a fraction of the `IN_TO - IN_FROM` stretch. */
const STAGGER = 0.03;

/** The progress (0 to 1) of the part number `index` as it emerges. Parts follow each other. */
export function emergeAt(local: number, index: number): number {
  const from = IN_FROM + index * STAGGER * (IN_TO - IN_FROM) * 4;
  return smooth(ramp(local, from, from + (IN_TO - IN_FROM) * 0.6));
}

/** The progress of the leaving: 0 while the section stands, 1 when it has gone. */
export function leaveAt(local: number): number {
  return smooth(ramp(local, OUT_FROM, OUT_TO));
}

/** What a row of the list shows: its opacity and its lift in pixels, from the emerge and the leave. */
export function rowLook(
  local: number,
  row: number,
  out: { opacity: number; lift: number },
): { opacity: number; lift: number } {
  const e = emergeAt(local, 3 + row * 0.6);
  const l = leaveAt(local);
  out.opacity = e * (1 - l);
  out.lift = (1 - e) * 26 - l * 34;
  return out;
}

interface Spot {
  /** The middle of the ball, in stage pixels (origin in the middle, y up). */
  x: number;
  y: number;
  /** The ball's diameter in CSS pixels. */
  h: number;
}

export interface DuoSpots {
  a: Spot;
  b: Spot;
}

export function newSpots(): DuoSpots {
  return { a: { x: 0, y: 0, h: 0 }, b: { x: 0, y: 0, h: 0 } };
}

/** A rectangle in stage pixels (y up): `top` is above `bottom`. */
export interface StageRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Screen {
  w: number;
  h: number;
}

export function ballSize(vp: Screen): number {
  return Math.min(28, Math.max(15, 0.036 * vp.w));
}

/** J9: off screen at the two side edges, level with the dwell. */
export function edgeSpots(vp: Screen, dwell: DuoSpots, out: DuoSpots): DuoSpots {
  const reach = vp.w / 2 + ballSize(vp) * 1.8;
  out.a.x = reach;
  out.a.y = dwell.a.y;
  out.a.h = dwell.a.h;
  out.b.x = reach;
  out.b.y = dwell.b.y;
  out.b.h = dwell.b.h;
  return out;
}

/** J10: in the two bottom corners, the list gone. */
export function cornerSpots(vp: Screen, out: DuoSpots): DuoSpots {
  // A phone keeps the size it floated at, so the pair does not grow as it settles.
  const h = ballSize(vp);
  // The ball and its gloves (about 1.25 diameters either side of the middle) stay on the screen,
  // on a phone as on a wide display.
  const x = Math.min(0.4 * vp.w, vp.w / 2 - 1.25 * h);
  out.a.x = -x;
  out.a.y = -0.38 * vp.h;
  out.a.h = h;
  out.b.x = x;
  out.b.y = -0.38 * vp.h;
  out.b.h = h;
  return out;
}

/** Keep even the outer gloves inside the space reserved beside the character name. */
export function dwellSpots(vp: Screen, dock: StageRect | null, out: DuoSpots): DuoSpots {
  const width = dock ? dock.right - dock.left : ballSize(vp) * 6;
  const height = dock ? dock.top - dock.bottom : ballSize(vp) * 2;
  const left = dock?.left ?? vp.w / 2;
  const center = dock ? (dock.top + dock.bottom) / 2 : 0;
  out.a.h = out.b.h = Math.min(ballSize(vp), width / 5.6, height / 2.4);
  out.a.x = left + width * 0.26;
  out.b.x = left + width * 0.74;
  out.a.y = center + height * 0.04;
  out.b.y = center - height * 0.04;
  return out;
}

const dwellScratch = newSpots();
const edgeScratch = newSpots();
const cornerScratch = newSpots();
const heldScratch: Spot = { x: 0, y: 0, h: 0 };

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

function copy(from: Spot, to: Spot): void {
  to.x = from.x;
  to.y = from.y;
  to.h = from.h;
}

function blend(from: Spot, to: Spot, t: number, out: Spot): void {
  out.x = mix(from.x, to.x, t);
  out.y = mix(from.y, to.y, t);
  out.h = mix(from.h, to.h, t);
}

/**
 * The two spots for a scroll position: arriving from the edges, standing, then leaving for the
 * corners. The second drone is a little behind the first on the way in and on the way out.
 */
export function duoSpotsAt(
  local: number,
  vp: Screen,
  dock: StageRect | null,
  out: DuoSpots,
): DuoSpots {
  const dwell = dwellSpots(vp, dock, dwellScratch);
  const edge = edgeSpots(vp, dwell, edgeScratch);
  const corner = cornerSpots(vp, cornerScratch);
  const span = IN_TO - IN_FROM;
  const inA = smooth(ramp(local, IN_FROM + 0.1 * span, IN_TO));
  const inB = smooth(ramp(local, IN_FROM + 0.25 * span, IN_TO + 0.03));
  const outA = smooth(ramp(local, OUT_FROM + (OUT_TO - OUT_FROM) * 0.6, OUT_TO));
  const outB = smooth(ramp(local, OUT_FROM + (OUT_TO - OUT_FROM) * 0.64, OUT_TO));
  blend(edge.a, dwell.a, inA, out.a);
  blend(edge.b, dwell.b, inB, out.b);
  if (outA > 0) {
    copy(out.a, heldScratch);
    blend(heldScratch, corner.a, outA, out.a);
  }
  if (outB > 0) {
    copy(out.b, heldScratch);
    blend(heldScratch, corner.b, outB, out.b);
  }
  return out;
}

/** The weight of the dance: it comes up quickly when a line plays and goes down more slowly. */
export function stepDance(weight: number, speaking: boolean, dt: number): number {
  const target = speaking ? 1 : 0;
  const rate = speaking ? 3.6 : 1.6;
  const next = weight + (target - weight) * (1 - Math.exp(-rate * Math.max(0, dt)));
  return Math.abs(target - next) < 0.004 ? target : next;
}
