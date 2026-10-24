/**
 * The Ender form shows through the normal one by itself, in shapes that change. The director
 * decides when and how: it waits, picks a shape, opens it, holds, and closes it, then waits
 * again. `figure-gl.ts` draws the shapes (the numbers here are the ids in its shader).
 */
export const SHAPES = ["slices", "tear", "bloom", "crown", "shatter"] as const;
interface IdleFrame {
  /** Index into SHAPES. */
  shape: number;
  /** 0 (closed) to 1 (as open as it gets), already shaped and scaled by `amp`. */
  env: number;
  /** Fixes the details of this run (where, which way). 0 to 1. */
  seed: number;
  /** How far this run opens, 0.65 to 1. */
  amp: number;
}

/** The envelope of one run: rises fast, holds and breathes, then falls. `u` is 0 to 1. */
export function envelope(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.36) {
    const k = u / 0.36;
    return 1 - Math.pow(1 - k, 3);
  }
  if (u < 0.58) return 0.94 + 0.06 * Math.sin(((u - 0.36) / 0.22) * Math.PI * 2);
  const k = (u - 0.58) / 0.42;
  return 0.94 * (1 - k * k * k);
}

export interface IdleDirector {
  /** Advance by `dt` seconds. `blocked` is true while the cursor is showing the form itself. */
  step: (dt: number, blocked: boolean) => IdleFrame;
}

export function createIdleDirector(rng: () => number = Math.random): IdleDirector {
  let wait = 1.6;
  let t = 0;
  let dur = 0;
  let shape = 0;
  let last = -1;
  let seed = 0.5;
  let amp = 1;
  let running = false;
  let closing = 0;
  let env = 0;

  const pick = () => {
    let s = Math.floor(rng() * SHAPES.length);
    if (s === last) s = (s + 1 + Math.floor(rng() * (SHAPES.length - 1))) % SHAPES.length;
    last = s;
    shape = s;
    seed = rng();
    amp = 0.65 + rng() * 0.35;
    dur = 1.9 + rng() * 1.0;
    t = 0;
    running = true;
    closing = 0;
  };

  return {
    step(dt, blocked) {
      if (running) {
        if (blocked && closing === 0) closing = env;
        if (closing > 0) {
          closing = Math.max(0, closing - dt * 2.6);
          env = closing;
          if (closing === 0) {
            running = false;
            wait = 2.4 + rng() * 2.6;
          }
        } else {
          t += dt;
          const u = t / dur;
          env = envelope(u);
          if (u >= 1) {
            running = false;
            env = 0;
            wait = 2.4 + rng() * 2.6;
          }
        }
      } else {
        env = 0;
        if (!blocked) {
          wait -= dt;
          if (wait <= 0) pick();
        }
      }
      return { shape, env: env * amp, seed, amp };
    },
  };
}
