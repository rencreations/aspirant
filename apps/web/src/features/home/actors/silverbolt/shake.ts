/**
 * The hard shake of Silverbolt: the whole body rattles along its own axis with a decaying
 * oscillation, the spine rolls once, the wings flare. It is the move that throws a rider off (the
 * bolt section), so it is a pure pose and a pure function of the time since it started: no hit, no
 * collision, nothing random. Nothing here knows about three.js.
 */
import { clamp, smoothstep } from "./math";

/** How long the shake lasts at strength 1 and at strength 0 (seconds): 0.8 to 1.2. */
export const SHAKE_LENGTH_MIN = 0.8;
export const SHAKE_LENGTH_MAX = 1.2;
/** The rattle along the body axis, in Hz, and its size in metres at the rest scale (strength 1). */
export const SHAKE_HZ = 6.5;
export const SHAKE_REACH_M = 0.12;
/** The vertical shudder: a faster, smaller rattle (Hz, metres). */
export const SHAKE_SHUDDER_HZ = 9.3;
export const SHAKE_SHUDDER_M = 0.035;
/** The roll of the spine about the body's own axis (radians at strength 1) and its pace. */
export const SHAKE_ROLL = 0.35;
export const SHAKE_ROLL_HZ = 3.2;
/** The nod of the whole body in the screen plane (radians at strength 1). */
export const SHAKE_NOD = 0.11;
export const SHAKE_NOD_HZ = 4.1;

export function shakeLength(strength: number): number {
  const s = clamp(strength, 0, 1);
  return SHAKE_LENGTH_MIN + (SHAKE_LENGTH_MAX - SHAKE_LENGTH_MIN) * s;
}

/**
 * The envelope, 0 to 1: a quick attack (0.05 s), a decay, and a tail that reaches exactly 0 at
 * the end of the shake so the pose never pops.
 */
export function shakeEnvelope(age: number, strength: number): number {
  const length = shakeLength(strength);
  if (age < 0 || age >= length) return 0;
  const attack = Math.min(1, age / 0.05);
  const decay = Math.exp((-2.6 * age) / length);
  const end = 1 - smoothstep(0.78 * length, length, age);
  return attack * decay * end;
}

/** The signed oscillation along the body axis, -1 to 1 (positive is toward the tail). */
export function shakeOscillation(age: number, strength: number): number {
  return Math.sin(age * Math.PI * 2 * SHAKE_HZ) * shakeEnvelope(age, strength);
}

/** What the pose takes from a shake `age` seconds after it started. */
export interface ShakeValues {
  /** The envelope, 0 to 1. */
  amount: number;
  /** The signed oscillation, -1 to 1. */
  osc: number;
  /** Metres at the rest scale: along the body axis (+ toward the tail), up, and the roll and nod in radians. */
  along: number;
  up: number;
  roll: number;
  nod: number;
  /** The whip of the spine and the tail: an angle per joint scale and a phase that travels back. */
  whip: number;
}

export function shakeAt(out: ShakeValues, age: number, strength: number): ShakeValues {
  const s = clamp(strength, 0, 1);
  const env = shakeEnvelope(age, s);
  out.amount = env * (0.4 + 0.6 * s);
  const wave = age * Math.PI * 2;
  out.osc = Math.sin(wave * SHAKE_HZ) * env;
  out.along = SHAKE_REACH_M * s * out.osc;
  out.up = SHAKE_SHUDDER_M * s * Math.sin(wave * SHAKE_SHUDDER_HZ + 1) * env;
  // The roll is brief and violent: it dies faster than the rattle.
  const rollEnv = shakeEnvelope(age * 1.6, s);
  out.roll = SHAKE_ROLL * s * Math.sin(wave * SHAKE_ROLL_HZ) * rollEnv;
  out.nod = SHAKE_NOD * s * Math.sin(wave * SHAKE_NOD_HZ + 0.7) * env;
  out.whip = s * env;
  return out;
}

export function newShakeValues(): ShakeValues {
  return { amount: 0, osc: 0, along: 0, up: 0, roll: 0, nod: 0, whip: 0 };
}
