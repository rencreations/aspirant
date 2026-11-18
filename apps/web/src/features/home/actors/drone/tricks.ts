/**
 * The drone's one-shot moves, each on its own clock (`about/choreo/tricks.ts`, without the show
 * that started by itself on a flight: on the home a section or a press decides). A move that has
 * started always finishes, whatever the scroll does, and a second is refused while one plays. The
 * answers to a press, the bow of a thank you and the shake of an annoyed drone are moves too.
 *
 * Everything is in the screen frame (y down): `dy` is in widths of the drone, negative is up.
 */
import { bump, clamp01, easeInOutSine, easeTurn, TAU } from "./ease";
import type { FaceName } from "./faces";

export type TrickKind =
  | "barrel"
  | "frontflip"
  | "backflip"
  | "spin"
  | "wiggle"
  | "loop"
  // The answers to a press.
  | "hop"
  | "roll"
  | "nod"
  | "dizzy"
  | "shake"
  // A thank you.
  | "bow";

/** What a move adds to the drone for this frame. */
export interface TrickPose {
  yaw: number;
  pitch: number;
  roll: number;
  /** In widths of the drone. */
  dx: number;
  dy: number;
  /** How hard the wings work, 0 to 1, and how far they flare open. */
  effort: number;
  flare: number;
  face: FaceName | null;
}

export interface Tricks {
  kind: TrickKind | null;
  /** Seconds into the move, and the way it goes (left or right). */
  t: number;
  dir: number;
}

/** Seconds each takes. */
export const TRICK_SECONDS: Readonly<Record<TrickKind, number>> = {
  barrel: 0.82,
  frontflip: 0.86,
  backflip: 0.86,
  spin: 0.78,
  wiggle: 0.72,
  loop: 1.08,
  hop: 0.95,
  roll: 0.9,
  nod: 0.85,
  dizzy: 1.6,
  shake: 0.9,
  bow: 1.25,
};

export function createTricks(): Tricks {
  return { kind: null, t: 0, dir: 1 };
}

/** Start a move now. Refused (false) while another one is playing. */
export function startTrick(tr: Tricks, kind: TrickKind, dir = 1): boolean {
  if (tr.kind) return false;
  tr.kind = kind;
  tr.t = 0;
  tr.dir = dir < 0 ? -1 : 1;
  return true;
}

/** Drop the move that is playing (a drone that was hidden and comes back). */
export function clearTrick(tr: Tricks): void {
  tr.kind = null;
  tr.t = 0;
}

export function stepTricks(tr: Tricks, dt: number): void {
  if (!tr.kind) return;
  tr.t += dt;
  if (tr.t >= TRICK_SECONDS[tr.kind]) tr.kind = null;
}

export function createTrickPose(): TrickPose {
  return { yaw: 0, pitch: 0, roll: 0, dx: 0, dy: 0, effort: 0, flare: 0, face: null };
}

/**
 * The bow: down over the first third, held a moment, up over the rest. 0 upright, 1 at the bottom.
 * The same curve is used by the thanks pose.
 */
export function bowCurve(p: number): number {
  const v = clamp01(p);
  if (v < 0.3) return easeInOutSine(v / 0.3);
  if (v < 0.5) return 1;
  return easeInOutSine(1 - (v - 0.5) / 0.5);
}

/** What the move adds to the drone right now, written into `out`. */
export function trickPose(tr: Tricks, out: TrickPose): TrickPose {
  out.yaw = 0;
  out.pitch = 0;
  out.roll = 0;
  out.dx = 0;
  out.dy = 0;
  out.effort = 0;
  out.flare = 0;
  out.face = null;
  const kind = tr.kind;
  if (!kind) return out;
  const p = clamp01(tr.t / TRICK_SECONDS[kind]);
  const b = bump(p);
  out.effort = 0.35 + 0.65 * b;
  out.face = "happy";
  switch (kind) {
    case "barrel":
      // Over the wing on the side it is flying to.
      out.roll = -tr.dir * TAU * easeTurn(p);
      out.dy = -0.1 * b;
      break;
    case "roll":
      out.roll = -tr.dir * TAU * easeTurn(p);
      out.dy = -0.2 * b;
      out.flare = 0.5 * b;
      out.face = "squint";
      break;
    case "frontflip":
      out.pitch = TAU * easeTurn(p);
      out.dy = -0.16 * b;
      break;
    case "backflip":
      out.pitch = -TAU * easeTurn(p);
      out.dy = -0.16 * b;
      break;
    case "spin":
      out.yaw = tr.dir * TAU * easeTurn(p);
      out.dy = -0.06 * b;
      break;
    case "wiggle":
      out.roll = Math.sin(TAU * 2.5 * p) * 0.42 * b;
      out.yaw = Math.sin(TAU * 1.5 * p + 1) * 0.2 * b;
      out.dy = -0.05 * Math.abs(Math.sin(TAU * 2.5 * p)) * b;
      break;
    case "loop": {
      // A whole circle in the air, on its back at the top.
      const angle = TAU * easeInOutSine(p);
      out.pitch = -angle;
      out.dx = tr.dir * 0.4 * Math.sin(angle);
      out.dy = -0.4 * (1 - Math.cos(angle));
      break;
    }
    case "hop":
      // A hop with a turn all the way round, wings wide.
      out.dy = -0.3 * Math.sin(Math.PI * Math.pow(p, 0.8));
      out.yaw = tr.dir * TAU * easeTurn(clamp01((p - 0.06) / 0.8));
      out.flare = b;
      break;
    case "nod":
      out.pitch = Math.sin(TAU * 2 * p) * 0.36 * Math.sqrt(1 - p);
      out.dy = 0.05 * Math.sin(TAU * 2 * p) * (1 - p);
      out.flare = 0.3 * b;
      break;
    case "dizzy":
      out.roll = Math.sin(TAU * 1.5 * p) * 0.5 * (1 - p);
      out.yaw = Math.sin(TAU * 1.1 * p) * 0.85 * (1 - p);
      out.dx = Math.sin(TAU * 1.5 * p) * 0.1 * (1 - p);
      out.effort = 0.2;
      out.face = p < 0.78 ? "dizzy" : "squint";
      break;
    case "shake":
      // No, no: a quick turn of the face from side to side and a tremble.
      out.yaw = Math.sin(TAU * 4 * p) * 0.5 * (1 - p * 0.6);
      out.roll = Math.sin(TAU * 5 * p) * 0.1 * (1 - p);
      out.dx = Math.sin(TAU * 7 * p) * 0.02 * (1 - p);
      out.effort = 0.45;
      out.flare = 0.4 * b;
      out.face = "angry";
      break;
    case "bow": {
      const c = bowCurve(p);
      out.pitch = 0.72 * c;
      out.dy = 0.07 * c;
      out.effort = 0.1;
      out.face = "thanks";
      break;
    }
  }
  return out;
}
