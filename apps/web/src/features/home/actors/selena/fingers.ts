/**
 * Her fingers. Each of the ten fingers has a curl from 0 (as the clip holds it) to 1 (closed). It
 * follows a target on a spring (1.5 Hz, damping 0.5: the feel of oryzo's hand, with the same
 * small overshoot), and the target comes from three places: the pointer near a fingertip (the
 * finger bends toward the palm, the further ones less), a wave that runs along the hand when she
 * is touched, and a fist while a hand is pressed. A slow breath moves every joint a little so the
 * hand is never still. The curl turns each joint of a finger about its flexion axis from the notes
 * (`selena.facts.json`, `skeleton.left|right.fingers`).
 */
import { Spring, clamp, smoothstep } from "./motion";

export type Side = "L" | "R";
export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export const FINGERS: readonly Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

/** The axis a positive angle curls a finger about, in each bone's own frame. */
export function flexAxis(side: Side, finger: Finger): readonly [number, number, number] {
  if (finger === "thumb") return side === "L" ? [0, 1, 0] : [0, -1, 0];
  return [0, 0, 1];
}

/** Per joint curl at weight 1, radians (knuckle, middle, tip), after the notes' mapping. */
const JOINT: readonly [number, number, number] = [0.18, 0.28, 0.2];
const FINGER_SCALE: Readonly<Record<Finger, number>> = {
  thumb: 0.55,
  index: 0.8,
  middle: 1,
  ring: 1.1,
  pinky: 1.25,
};
/** The curl of a closed hand: the pointer asks for up to 1, a pressed hand for this. */
export const FIST = 3;
/** The most any joint may turn, radians (a clamp on pointer, wave, fist and breath together). */
export const MAX_JOINT = 1.35;
/** A finger may reach back a little when the pointer is beyond its tip. */
const MIN_CURL = -0.2;

/** The turn of one joint of a finger at a curl, radians. */
export function jointAngle(finger: Finger, joint: 0 | 1 | 2, curl: number): number {
  const per = JOINT[joint] * FINGER_SCALE[finger];
  return clamp(curl * per, MIN_CURL * per, MAX_JOINT);
}

export interface HandInput {
  /** The pointer, in stage pixels. */
  px: number;
  py: number;
  /** The five fingertips on the screen (x, y a finger, thumb to pinky) and the palm. */
  tips: ArrayLike<number>;
  palmX: number;
  palmY: number;
  /** The hand's size on the screen: the palm to the middle fingertip, in pixels. */
  radius: number;
  /** False when the pointer is not on the page (a touch that is up). */
  live: boolean;
}

/**
 * What the pointer asks of each finger of a hand: how much it bends toward the palm. The pointer
 * near a tip bends that finger, the neighbours less, and nothing happens unless the pointer is
 * within about two hand sizes of the palm.
 */
export function pointerCurl(input: HandInput, out: Float32Array, o: number): void {
  const r = Math.max(10, input.radius);
  const gate = input.live
    ? 1 -
      smoothstep((Math.hypot(input.px - input.palmX, input.py - input.palmY) - 1.1 * r) / (1.4 * r))
    : 0;
  const sigma = 0.55 * r;
  for (let f = 0; f < 5; f += 1) {
    const dx = input.px - input.tips[f * 2]!;
    const dy = input.py - input.tips[f * 2 + 1]!;
    const near = Math.exp(-((dx * dx + dy * dy) / (sigma * sigma)));
    out[o + f] = near * gate * 0.85;
  }
}

/** A wave along the hand: the curl of finger `f` at time `t` while a reaction with strength `env` runs. */
export function waveCurl(f: number, t: number, env: number): number {
  if (env <= 0) return 0;
  return env * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 2.6 - f * 0.95)) * 0.85;
}

/** The breath: a small, slow move on every joint, so a hand that nothing touches is alive. */
export function breath(side: Side, f: number, joint: number, t: number): number {
  const phase = (side === "L" ? 0.7 : 2.1) + f * 1.3 + joint * 0.8;
  const hz = 0.17 + ((f * 3 + joint) % 5) * 0.04;
  return 0.025 * Math.sin(t * 2 * Math.PI * hz + phase);
}

/** Ten springs, one for each finger. */
export class FingerBank {
  private readonly springs: Spring[] = [];

  constructor() {
    for (let i = 0; i < 10; i += 1) this.springs.push(new Spring(2 * Math.PI * 1.5, 0.5, 0));
  }

  /** Move a finger toward its target. A `dt` of 0 changes nothing. */
  step(hand: 0 | 1, finger: number, target: number, dt: number): number {
    return this.springs[hand * 5 + finger]!.step(clamp(target, MIN_CURL, FIST), dt);
  }

  value(hand: 0 | 1, finger: number): number {
    return this.springs[hand * 5 + finger]!.x;
  }

  /** Put every finger at rest (a jump). */
  snap(): void {
    for (const s of this.springs) s.snap(0);
  }
}
