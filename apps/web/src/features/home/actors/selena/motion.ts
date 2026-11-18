/**
 * Small pure helpers of motion: exact springs (any step is stable, a frozen frame changes nothing),
 * easing and a deterministic random. No three.js here.
 */

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Exponential approach: the fraction of the gap closed in `dt` seconds at `rate` per second. */
export function approach(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * Math.max(0, dt));
}

/** A damped spring solved exactly, so any `dt` is stable. `omega` in rad/s, `zeta` the damping ratio. */
export class Spring {
  x: number;
  v = 0;

  constructor(
    readonly omega: number,
    readonly zeta: number,
    x = 0,
  ) {
    this.x = x;
  }

  /** Move toward `target` for `dt` seconds. A `dt` of 0 changes nothing. */
  step(target: number, dt: number): number {
    if (!(dt > 0)) return this.x;
    const w = this.omega;
    const z = this.zeta;
    const d = this.x - target;
    if (z >= 1) {
      const e = Math.exp(-w * dt);
      const b = this.v + w * d;
      this.x = target + (d + b * dt) * e;
      this.v = (this.v - b * w * dt) * e;
      return this.x;
    }
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w * dt);
    const c = Math.cos(wd * dt);
    const s = Math.sin(wd * dt);
    const b = (this.v + z * w * d) / wd;
    this.x = target + e * (d * c + b * s);
    this.v = e * (-z * w * (d * c + b * s) + (-d * wd * s + b * wd * c));
    return this.x;
  }

  /** Put the spring at rest at `x`. */
  snap(x = 0): void {
    this.x = x;
    this.v = 0;
  }

  /** Give the spring a push. */
  kick(v: number): void {
    this.v += v;
  }
}

/** A small deterministic generator (mulberry32), so blinks and idle motion repeat in tests. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
