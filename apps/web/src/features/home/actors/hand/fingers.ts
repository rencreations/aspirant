/**
 * The fingers, as pure maths. Each of the five fingers has a curl: 0 is how the clip holds it, 1 is
 * the pointer's full reach (about 40 degrees over the three joints, after the notes' mapping of
 * oryzo's hand), 3 is a closed grip. The curl follows a target on a spring (1.5 Hz, damping 0.5,
 * the feel of oryzo's), and the target comes from three places: the pointer near a fingertip (the
 * closer, the more the finger bends toward the palm; a pointer beyond the tip makes it reach), a
 * ripple that runs along the hand when she is touched, and a grip while the hand is pressed.
 *
 * `spread` is the fan: positive turns a finger toward the thumb. Fingers fan toward the pointer
 * together, so the gap between two neighbours never closes past what the model has (5 mm at the
 * nearest pair), and `resolveSpread` enforces it.
 *
 * Nothing here knows three.js: the actor turns the numbers into rotations of bones.
 */
import { distToSegment } from "./hit";
import { Spring, clamp, lerp, smoothstep } from "./motion";

export const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
export type FingerName = (typeof FINGERS)[number];
export const FINGER_COUNT = FINGERS.length;

/** The three bones of a finger, root first (`Bip001_L_Finger<n>`, `...<n>1`, `...<n>2`). */
export function fingerBones(finger: FingerName): readonly [string, string, string] {
  const base = `Bip001_L_Finger${FINGERS.indexOf(finger)}`;
  return [base, `${base}1`, `${base}2`];
}

/** The axis, in each bone's own frame, a positive angle about which curls the finger toward the palm. */
export function flexAxis(finger: FingerName): readonly [number, number, number] {
  return finger === "thumb" ? [0, 1, 0] : [0, 0, 1];
}

/** The axis, in the root bone's frame, that fans the finger (positive: toward the thumb). */
export function spreadAxis(finger: FingerName): readonly [number, number, number] {
  return finger === "thumb" ? [1, 0, 0] : [0, 1, 0];
}

/** The turn of each joint (knuckle, middle, tip) at a curl of 1, radians, before the finger's scale. */
const JOINT_ONE: readonly [number, number, number] = [0.18, 0.28, 0.2];
const FINGER_SCALE: Readonly<Record<FingerName, number>> = {
  thumb: 0.55,
  index: 0.8,
  middle: 1,
  ring: 1.1,
  pinky: 1.25,
};
/**
 * The turn of each joint at the grip. It is a cupped claw, not a fist: the claws are long and a
 * fist would drive them into the palm. The thumb tucks less.
 */
const JOINT_FIST: readonly [number, number, number] = [0.8, 0.95, 0.6];
const FIST_SCALE: Readonly<Record<FingerName, number>> = {
  thumb: 1,
  index: 0.95,
  middle: 1,
  ring: 1,
  pinky: 0.95,
};

/** The curl of the grip. */
export const FIST = 3;
/** The least a finger may curl: it reaches back a little when the pointer is beyond its tip. */
const MIN_CURL = -0.2;
/** The spring may overshoot the open hand a little when a grip is let go. */
const MIN_BANK = -0.35;
/** The most any one joint may turn, radians. */
export const MAX_JOINT = 1.5;

/** The turn of one joint of a finger at a curl, radians. Positive curls toward the palm. */
export function jointAngle(finger: FingerName, joint: 0 | 1 | 2, curl: number): number {
  const one = JOINT_ONE[joint] * FINGER_SCALE[finger];
  if (curl <= 1) return Math.max(curl, MIN_CURL * 1.75) * one;
  const fist = JOINT_FIST[joint] * FIST_SCALE[finger];
  const t = clamp((curl - 1) / (FIST - 1), 0, 1);
  return Math.min(MAX_JOINT, lerp(one, fist, t));
}

/** The whole turn of a finger over its three joints at a curl, radians. */
export function totalCurl(finger: FingerName, curl: number): number {
  return jointAngle(finger, 0, curl) + jointAngle(finger, 1, curl) + jointAngle(finger, 2, curl);
}

// ---------------------------------------------------------------------------------------------
// What the pointer asks of the hand.

/** What the pointer asks of the hand this frame. */
export interface Reach {
  /** The curl each finger is asked for (thumb to pinky). */
  readonly curl: Float32Array;
  /** The fan each finger is asked for, radians, positive toward the thumb (the thumb's is 0). */
  readonly spread: Float32Array;
  /** How much the pointer is on the hand at all, 0 to 1. */
  gate: number;
  /** The wrist leans toward the pointer: roll to the side (positive: the palm turns to the right). */
  roll: number;
  /** The wrist nods toward the pointer: positive when the pointer is above the palm. */
  nod: number;
  /** The finger nearest to the pointer (thumb 0 to pinky 4), the one the ripple starts at. */
  nearest: number;
}

export function makeReach(): Reach {
  return {
    curl: new Float32Array(FINGER_COUNT),
    spread: new Float32Array(FINGER_COUNT),
    gate: 0,
    roll: 0,
    nod: 0,
    nearest: 2,
  };
}

export interface ReachInput {
  /** The pointer in the stage's pixel frame. */
  px: number;
  py: number;
  /** False when no pointer is on the page (a touch that is up). */
  live: boolean;
  /** The fingertips on the screen, two numbers a finger (thumb to pinky). */
  tips: ArrayLike<number>;
  /** The finger roots (knuckles) on the screen, laid out the same way. */
  knuckles: ArrayLike<number>;
  palmX: number;
  palmY: number;
  /** The hand's size on the screen: the palm to the middle fingertip, in pixels. */
  length: number;
}

/** The share of the hand's length within which a fingertip answers the pointer. */
const SIGMA = 0.45;
/**
 * The pointer asks nothing of the hand when it is farther than `GATE_FAR` hand lengths from the
 * palm and from every tip, and the whole of it inside `GATE_NEAR`.
 */
const GATE_NEAR = 0.35;
const GATE_FAR = 1;
const scratchProx = [0, 0, 0, 0, 0];
const scratchBase = [0, 0, 0, 0, 0];
/** The widest fan, radians, and the widest closing of two neighbours. */
const SPREAD_MAX = 0.14;
export const SPREAD_GAP = 0.03;
/** The wrist's lean toward the pointer, radians (4 degrees and 3). */
const LEAN_ROLL = 0.1;
const LEAN_NOD = 0.07;
/** The curl of a finger whose tip the pointer is beyond (it reaches). */
const BEYOND = -0.15;
/**
 * How much the pointer asks beyond the notes' mapping (a curl of 1 is 40 degrees: oryzo's hand is
 * deliberately subtle, and this hand is seen face on, where a curl toward the palm is foreshortened).
 */
export const REACH_GAIN = 2.6;

/**
 * Fill `out` with what the pointer asks of the hand. Closer is more curl; a pointer on the palm side
 * of a tip bends the finger toward it, a pointer beyond the tip makes the finger reach; the fingers
 * fan toward the side the pointer is on.
 */
export function reachFor(input: ReachInput, out: Reach): void {
  const L = Math.max(10, input.length);
  const dPalm = Math.hypot(input.px - input.palmX, input.py - input.palmY);
  const sigma = SIGMA * L;
  const inv = 1 / (sigma * sigma);

  let nearest = 2;
  let best = Infinity;
  const prox = scratchProx;
  const base = scratchBase;
  for (let f = 0; f < FINGER_COUNT; f += 1) {
    const tx = input.tips[f * 2]!;
    const ty = input.tips[f * 2 + 1]!;
    const kx = input.knuckles[f * 2]!;
    const ky = input.knuckles[f * 2 + 1]!;
    const dx = input.px - tx;
    const dy = input.py - ty;
    // How near the pointer is to the finger: its distance to the line from the knuckle to the tip,
    // so a pointer on the palm or on the finger itself asks as much as one at the tip.
    const dSeg = distToSegment(input.px, input.py, kx, ky, tx, ty);
    prox[f] = Math.exp(-dSeg * dSeg * inv);
    if (dSeg < best) {
      best = dSeg;
      nearest = f;
    }
    // Which side of the tip the pointer is on, along the finger.
    let ux = tx - kx;
    let uy = ty - ky;
    const ul = Math.hypot(ux, uy);
    if (ul < 1e-3) {
      ux = 0;
      uy = 1;
    } else {
      ux /= ul;
      uy /= ul;
    }
    const along = dx * ux + dy * uy;
    const s = clamp(-along / (0.8 * sigma), -1, 1);
    base[f] =
      s < -0.3 ? lerp(0.35, BEYOND, (-0.3 - s) / 0.7) : 0.35 + 0.65 * smoothstep(-0.3, 0.8, s);
  }
  // The pointer is on the hand when it is near the palm or near any tip.
  const dNear = Math.min(dPalm, best);
  const gate = input.live ? 1 - smoothstep(GATE_NEAR * L, GATE_FAR * L, dNear) : 0;
  for (let f = 0; f < FINGER_COUNT; f += 1) out.curl[f] = gate * prox[f]! * base[f]! * REACH_GAIN;
  // The thumb closes toward the palm when the pointer is on the palm.
  const onPalm = 1 - smoothstep(0.15 * L, 0.8 * L, dPalm);
  out.curl[0] = Math.max(gate * onPalm, out.curl[0]! * 0.7);

  const side = clamp((input.px - input.palmX) / (0.7 * L), -1, 1);
  out.spread[0] = 0;
  for (let f = 1; f < FINGER_COUNT; f += 1) {
    out.spread[f] = -side * SPREAD_MAX * gate * (0.55 + 0.45 * prox[f]!);
  }
  resolveSpread(out.spread);

  out.gate = gate;
  out.roll = side * gate * LEAN_ROLL;
  out.nod = clamp((input.py - input.palmY) / (1.2 * L), -1, 1) * gate * LEAN_NOD;
  out.nearest = nearest;
}

/**
 * Keep two neighbouring fingers from closing into each other. `spread` is in radians, positive
 * toward the thumb, index at 1 to pinky at 4. Where the pinky side finger moves toward the thumb
 * more than the thumb side one by more than `SPREAD_GAP`, each gives half of the excess back.
 */
export function resolveSpread(spread: Float32Array): void {
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 1; i < FINGER_COUNT - 1; i += 1) {
      const closing = spread[i + 1]! - spread[i]!;
      if (closing > SPREAD_GAP) {
        const give = (closing - SPREAD_GAP) / 2;
        spread[i + 1] = spread[i + 1]! - give;
        spread[i] = spread[i]! + give;
      }
    }
  }
}

/** The envelope of a ripple that is `age` seconds old and lasts `duration`: 1 at the start, 0 at the end. */
export function rippleEnvelope(age: number, duration: number): number {
  if (age < 0 || age >= duration) return 0;
  const u = age / duration;
  return (1 - u) * (1 - u);
}

/**
 * The curl a ripple adds to finger `f` at time `t`: a wave that runs along the hand from the
 * finger the touch started at (`from`), strength `env`.
 */
export function waveCurl(f: number, from: number, t: number, env: number): number {
  if (env <= 0) return 0;
  const phase = Math.abs(f - from) * 0.95;
  return env * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 2.6 - phase)) * 0.75;
}

/** The slow, small move of every joint so a hand nothing touches is never still. Radians. */
export function idleAngle(f: number, joint: number, t: number): number {
  const phase = 0.7 + f * 1.3 + joint * 0.8;
  const hz = 0.17 + ((f * 3 + joint) % 5) * 0.04;
  return 0.028 * Math.sin(t * 2 * Math.PI * hz + phase);
}

/** The delay of a finger behind the nearest one, in seconds a finger of rank (the ripple of a sweep). */
const RIPPLE = 0.03;

/** Five springs for the curl and five for the fan, with a short lag that makes a sweep ripple. */
export class FingerBank {
  readonly curl = new Float32Array(FINGER_COUNT);
  readonly spread = new Float32Array(FINGER_COUNT);
  private readonly curlSprings: Spring[] = [];
  private readonly spreadSprings: Spring[] = [];
  private readonly lagCurl = new Float32Array(FINGER_COUNT);
  private readonly lagSpread = new Float32Array(FINGER_COUNT);

  constructor() {
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      this.curlSprings.push(new Spring(2 * Math.PI * 1.5, 0.5, 0));
      this.spreadSprings.push(new Spring(2 * Math.PI * 1.8, 0.7, 0));
    }
  }

  /** Move every finger toward what is asked. A `dt` of 0 changes nothing. */
  step(
    wantCurl: ArrayLike<number>,
    wantSpread: ArrayLike<number>,
    nearest: number,
    dt: number,
  ): void {
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      const lag = Math.abs(f - nearest) * RIPPLE;
      const a = lag > 0 ? 1 - Math.exp(-dt / lag) : dt > 0 ? 1 : 0;
      this.lagCurl[f] = this.lagCurl[f]! + (wantCurl[f]! - this.lagCurl[f]!) * a;
      this.lagSpread[f] = this.lagSpread[f]! + (wantSpread[f]! - this.lagSpread[f]!) * a;
      this.curl[f] = this.curlSprings[f]!.step(clamp(this.lagCurl[f]!, MIN_BANK, FIST), dt);
      this.spread[f] = this.spreadSprings[f]!.step(this.lagSpread[f]!, dt);
    }
  }

  /** Put every finger at rest (a jump). */
  snap(): void {
    for (let f = 0; f < FINGER_COUNT; f += 1) {
      this.curlSprings[f]!.snap(0);
      this.spreadSprings[f]!.snap(0);
      this.lagCurl[f] = 0;
      this.lagSpread[f] = 0;
      this.curl[f] = 0;
      this.spread[f] = 0;
    }
  }
}
