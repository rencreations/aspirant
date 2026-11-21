/**
 * How the body answers a pointer. The head is locked (it stays in one line with the body, looking
 * toward the heading), so only the body moves: a slow lean in the screen plane toward the pointer's
 * side, a small shift along the body, a small bank, and a livelier wave in the tail. Never a
 * stretch: every number here is a small angle or a small distance. Pure, no three.js.
 */
import { clamp, softClamp } from "./math";

/** The largest lean of the body in the screen plane, radians. */
export const LEAN_PITCH = 0.12;
/** The largest bank about the body's own axis, radians. */
export const LEAN_ROLL = 0.07;
/** The largest shift of the body toward the pointer, metres at the rest scale. */
export const LEAN_SHIFT_M = 0.09;
/** The pointer's distance, in metres of the dragon's own size, at which the lean is full. */
const LEAN_REACH_M = 1.3;
/** Inside this many metres of the body the pointer says little (it is on the dragon). */
const LEAN_DEAD_M = 0.25;
/** The tail wave grows by this much with the lean (0 to 1 is the share of the pointer's pull). */
const LEAN_TAIL_BOOST = 0.9;

export interface Lean {
  /** Radians: positive lifts the nose (the pointer is above). */
  pitch: number;
  /** Radians: a small bank, so the body turns a shoulder toward the pointer. */
  roll: number;
  /** Metres at the rest scale along the nose axis: positive toward the nose. */
  shift: number;
  /** 0 to 1: how strongly the tail's wave is lifted. */
  tail: number;
}

export function newLean(): Lean {
  return { pitch: 0, roll: 0, shift: 0, tail: 0 };
}

/**
 * The lean the pointer asks for. `forward` and `up` are the pointer's offset from the body, in
 * metres of the dragon's frame (forward along the nose, up along its back); `weight` is how much
 * the section lets the dragon follow (0 to 1).
 */
export function leanFor(out: Lean, forward: number, up: number, weight: number): Lean {
  const w = clamp(weight, 0, 1);
  const dist = Math.hypot(forward, up);
  // On the dragon itself the direction means nothing: ease the lean in from the dead zone.
  const reach = clamp((dist - LEAN_DEAD_M) / (LEAN_REACH_M - LEAN_DEAD_M), 0, 1);
  const k = dist > 1e-6 ? reach / dist : 0;
  const ux = softClamp(forward * k, 1);
  const uy = softClamp(up * k, 1);
  out.pitch = LEAN_PITCH * uy * w;
  out.roll = LEAN_ROLL * ux * w;
  out.shift = LEAN_SHIFT_M * ux * w;
  out.tail = LEAN_TAIL_BOOST * reach * w;
  return out;
}
