/**
 * Small pure helpers of motion: springs that are exact for any step (a frozen frame and a long
 * frame both behave), easing, the walk's stride and a deterministic noise. No three.js here.
 */
import { DOLL_HEIGHT, WALK_SECONDS, WALK_SPEED } from "./rig";

/** An element of an array, 0 when there is none: the repository reads arrays with `noUncheckedIndexedAccess`. */
export function at(a: ArrayLike<number>, i: number): number {
  return a[i] ?? 0;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** A critically damped or under damped spring, solved exactly, so any `dt` is stable. */
export class Spring {
  x: number;
  v = 0;

  constructor(
    private readonly omega: number,
    private readonly zeta: number,
    x = 0,
  ) {
    this.x = x;
  }

  /** Move toward `target` for `dt` seconds. A `dt` of 0 changes nothing. */
  step(target: number, dt: number): void {
    if (!(dt > 0)) return;
    const w = this.omega;
    const d = this.x - target;
    const z = this.zeta;
    if (z >= 1) {
      const e = Math.exp(-w * dt);
      const b = this.v + w * d;
      this.x = target + (d + b * dt) * e;
      this.v = (this.v - b * w * dt) * e;
      return;
    }
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w * dt);
    const c = Math.cos(wd * dt);
    const s = Math.sin(wd * dt);
    const b = (this.v + z * w * d) / wd;
    this.x = target + e * (d * c + b * s);
    this.v = e * (-z * w * (d * c + b * s) + (-d * wd * s + b * wd * c));
  }

  /** Put the spring at rest at `x` (a jump of the target). */
  reset(x = 0): void {
    this.x = x;
    this.v = 0;
  }

  /** Give the spring a push. */
  kick(v: number): void {
    this.v += v;
  }
}

/** Follow a value with an exponential smoothing that is exact for any `dt`. `rate` is 1 over the time constant. */
export function approach(from: number, to: number, rate: number, dt: number): number {
  if (!(dt > 0)) return from;
  return to + (from - to) * Math.exp(-rate * dt);
}

/**
 * A fast hash noise in -1 to 1 from an integer. Used where a pure function of time needs a random
 * looking choice (when a blink starts). Deterministic: the same integer gives the same number.
 */
export function hash(n: number): number {
  let x = Math.imul(Math.floor(n) | 0, 0x9e3779b1) ^ 0x85ebca6b;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  x ^= x >>> 15;
  return ((x >>> 0) / 4294967295) * 2 - 1;
}

/** Pixels per second that the planted foot moves at when the walk plays at `rate`, for a doll `height` px tall. */
export function strideSpeed(rate: number, height: number): number {
  return (WALK_SPEED * rate * height) / DOLL_HEIGHT;
}

/** The walk rate that matches a ground speed in pixels per second. */
export function walkRateFor(speed: number, height: number): number {
  return height > 0 ? (speed * DOLL_HEIGHT) / (WALK_SPEED * height) : 0;
}

/** The walk's phase, in cycles, after a doll `height` px tall has travelled `distance` px. Scrub the walk with it. */
export function walkPhaseFor(distance: number, height: number): number {
  const cyclePx = (WALK_SPEED * WALK_SECONDS * height) / DOLL_HEIGHT;
  return cyclePx > 0 ? distance / cyclePx : 0;
}
