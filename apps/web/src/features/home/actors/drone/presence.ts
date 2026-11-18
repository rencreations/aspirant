/**
 * How present the drone is: 1 when it is here, 0 when it is gone. Coming in it is a spring that
 * overshoots (a pop) and settles; going out it shrinks away fast with no overshoot. The drone's
 * drawn size is multiplied by it, and the wings flutter while it moves. Pure arithmetic: no three.
 */

export interface Presence {
  x: number;
  v: number;
}

/** The pop's spring: quick, and under-damped so that it runs about a tenth past 1. */
const POP_OMEGA = 17;
const POP_ZETA = 0.42;
/** How fast it goes, in 1 / seconds: it is under 2 percent after a quarter of a second. */
const GO_RATE = 14;
/** Below this the drone is taken as gone. */
export const GONE = 0.002;

export function createPresence(here = true): Presence {
  return { x: here ? 1 : 0, v: 0 };
}

/** One step toward `here` (true: come in, false: go). Stepped in slices, so a long frame is safe. */
export function stepPresence(p: Presence, here: boolean, dt: number): void {
  if (!(dt > 0)) return;
  if (here) {
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      p.v += (-POP_OMEGA * POP_OMEGA * (p.x - 1) - 2 * POP_ZETA * POP_OMEGA * p.v) * h;
      p.x += p.v * h;
    }
    return;
  }
  p.x *= Math.exp(-GO_RATE * dt);
  p.v = 0;
  if (p.x < GONE) p.x = 0;
}
