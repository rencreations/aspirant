/** Small pure helpers of motion: clamps, easings and the one spring the hand uses. */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0 below `e0`, 1 above `e1`, a smooth step between (an inverted edge pair gives the mirror). */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Move `current` toward `target` at an exponential rate (per second). Never overshoots. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-Math.max(0, rate) * Math.max(0, dt));
}

/** The longest step the spring integrates in one go (seconds). */
const SUBSTEP = 1 / 120;
const MAX_STEPS = 12;

/**
 * A second order spring toward a target: `omega` is the angular frequency (2 pi f), `zeta` the
 * damping ratio (1 is critical, below 1 overshoots). It integrates in fixed small steps, so a long
 * frame cannot blow it up, and a `dt` of 0 changes nothing.
 */
export class Spring {
  v = 0;

  constructor(
    private readonly omega: number,
    private readonly zeta: number,
    public x = 0,
  ) {}

  step(target: number, dt: number): number {
    if (dt <= 0) return this.x;
    const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(dt / SUBSTEP)));
    const h = Math.min(dt, SUBSTEP * MAX_STEPS) / steps;
    const k = this.omega * this.omega;
    const c = 2 * this.zeta * this.omega;
    for (let i = 0; i < steps; i += 1) {
      this.v += (k * (target - this.x) - c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  /** Put the spring at rest on `x` (a jump). */
  snap(x = 0): void {
    this.x = x;
    this.v = 0;
  }

  /** Add speed (a kick), in units per second. */
  kick(v: number): void {
    this.v += v;
  }
}
