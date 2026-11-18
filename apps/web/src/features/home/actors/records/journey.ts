/**
 * The journey of one record: crate (0), held in a hand (1), on the platter (2). `p` is where it is
 * along that way. The section sets a target (0, 1 or 2) and the actor moves `p` toward it at a
 * steady pace, so a jump to a far target plays the whole way, and a change of mind turns back
 * along the same path (every pose is a pure function of `p`).
 *
 *   p 0 to 1 (segment A): the sleeve rises out of the crate, the disc slides out of the sleeve, the
 *                         sleeve drops back, the disc flies to the hand.
 *   p 1 to 2 (segment B): the disc is carried from the hand to the platter and laid on it.
 */
import { clamp } from "../gramophone/frame";

/** Seconds for the pick (segment A) and for the putting on (segment B). */
export const SEG_A_SECONDS = 1.7;
export const SEG_B_SECONDS = 1.3;

/** Smoothstep ease on 0..1. */
export const ease = (t: number): number => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/**
 * Move `p` toward `target` at the pace of the segment it is in. Returns the new `p`; it lands on
 * the target exactly.
 */
export function stepJourney(p: number, target: number, dt: number): number {
  if (!(dt > 0) || p === target) return p;
  let left = dt;
  let at = p;
  // A step may cross the joint between the two segments (p = 1), which have different paces.
  for (let guard = 0; guard < 4 && left > 0 && at !== target; guard++) {
    const up = target > at;
    // Going up from 1 is segment B; coming down to 1 from above is segment B too.
    const inA = up ? at < 1 : at <= 1;
    const pace = 1 / (inA ? SEG_A_SECONDS : SEG_B_SECONDS);
    const edge = up
      ? inA
        ? Math.min(1, target)
        : Math.min(2, target)
      : inA
        ? Math.max(0, target)
        : Math.max(1, target);
    const room = Math.abs(edge - at) / pace;
    if (room <= left) {
      at = edge;
      left -= room;
    } else {
      at += (up ? 1 : -1) * pace * left;
      left = 0;
    }
  }
  return at;
}

export interface Phases {
  /** The sleeve comes out of the crate. */
  lift: number;
  /** The disc slides out of the sleeve. */
  slide: number;
  /** The disc flies from the sleeve to the hand. */
  fly: number;
  /** The sleeve goes back into the crate. */
  drop: number;
  /** The disc is carried from the hand to the platter. */
  carry: number;
}

/** The weights of the sub steps at a place on the journey. All are 0 to 1 and eased. */
export function phasesAt(p: number, out: Phases): Phases {
  const a = clamp(p, 0, 1);
  const b = clamp(p - 1, 0, 1);
  out.lift = ease(a / 0.3);
  out.slide = ease((a - 0.3) / 0.25);
  out.fly = ease((a - 0.55) / 0.45);
  out.drop = ease((a - 0.62) / 0.3);
  out.carry = ease(b);
  return out;
}

export interface CarryLegs {
  /** The first leg: from the hand to the place beside the platter, along an arc. 0 to 1. */
  approach: number;
  /** The second leg: sliding in over the platter and down onto it. 0 to 1. */
  glide: number;
  /** The disc turns from face on to lying flat, and finishes by the end of the first leg. 0 to 1. */
  turn: number;
}

/** Where the first leg ends and the second begins, as a share of the carry. */
const LEG_SPLIT = 0.55;

/**
 * The carry from the hand to the platter has two legs, because the horn hangs over the platter and
 * a disc cannot be dropped on it from above: it comes to a place beside the platter (lying flat by
 * then) and slides in at the platter's height.
 */
export function carryLegs(carry: number, out: CarryLegs): CarryLegs {
  out.approach = ease(carry / LEG_SPLIT);
  out.glide = ease((carry - LEG_SPLIT) / (1 - LEG_SPLIT));
  out.turn = ease(carry / (LEG_SPLIT * 0.9));
  return out;
}

export type JourneyPhase = "idle" | "picking" | "held" | "placing" | "seated" | "returning";

/** What the record is doing, for the section. */
export function journeyPhase(p: number, target: number): JourneyPhase {
  if (p === target) return p === 0 ? "idle" : p === 1 ? "held" : p === 2 ? "seated" : "held";
  if (target < p) return "returning";
  return p < 1 ? "picking" : "placing";
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** A point on a parabola from `a` to `b` that rises `height` above the straight line at the middle. */
export function arcPoint(out: Point3, a: Point3, b: Point3, t: number, height: number): Point3 {
  const u = clamp(t, 0, 1);
  const rise = height * 4 * u * (1 - u);
  out.x = a.x + (b.x - a.x) * u;
  out.y = a.y + (b.y - a.y) * u + rise;
  out.z = a.z + (b.z - a.z) * u;
  return out;
}
