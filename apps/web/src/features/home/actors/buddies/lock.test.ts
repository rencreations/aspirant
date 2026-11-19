import { describe, expect, it } from "vitest";

import {
  CALM_FOR,
  RAMP_DOWN,
  RAMP_UP,
  SETTLED,
  SPEED_OFF,
  SPEED_ON,
  closeLock,
  createLock,
  stepLock,
  type LockInput,
} from "./lock";

const DT = 1 / 60;
const still: LockInput = { velocity: 0, wheel: 0, droneSpeed: 0 };

function run(s: ReturnType<typeof createLock>, seconds: number, input: LockInput): number {
  let w = s.weight;
  for (let t = 0; t < seconds; t += DT) w = stepLock(s, DT, input);
  return w;
}

describe("the pair's scroll lock", () => {
  it("starts closed and opens after the calm and the settle, over the ramp", () => {
    const s = createLock();
    expect(s.weight).toBe(0);
    // Calm for less than the tolerance: still closed.
    expect(run(s, CALM_FOR - 0.1, still)).toBe(0);
    const w = run(s, 0.2, still);
    expect(w).toBeGreaterThanOrEqual(0);
    expect(run(s, RAMP_UP + 0.1, still)).toBe(1);
  });

  it("locks at once when the scroll is active and falls without a jump", () => {
    const s = createLock();
    run(s, 2, still);
    expect(s.weight).toBe(1);
    const steps: number[] = [];
    let last = s.weight;
    for (let t = 0; t < 0.5; t += DT) {
      const w = stepLock(s, DT, { velocity: SPEED_ON * 2, wheel: 0, droneSpeed: 0 });
      steps.push(Math.abs(w - last));
      last = w;
    }
    expect(last).toBe(0);
    // The biggest step is the steepest part of a smoothstep over RAMP_DOWN.
    expect(Math.max(...steps)).toBeLessThan((1.5 * DT) / RAMP_DOWN + 1e-6);
  });

  it("has a hysteresis on the speed: between the two thresholds it does not toggle", () => {
    const s = createLock();
    run(s, 2, still);
    const between = (SPEED_ON + SPEED_OFF) / 2;
    // From open, a speed between the two is not active.
    run(s, 1, { velocity: between, wheel: 0, droneSpeed: 0 });
    expect(s.locked).toBe(false);
    // Once locked by a fast scroll, the same speed keeps it locked.
    run(s, 0.3, { velocity: SPEED_ON * 2, wheel: 0, droneSpeed: 0 });
    expect(s.locked).toBe(true);
    run(s, 2, { velocity: between, wheel: 0, droneSpeed: 0 });
    expect(s.locked).toBe(true);
    // Under the lower threshold it is calm and opens.
    run(s, CALM_FOR + RAMP_UP + 0.2, { velocity: SPEED_OFF / 2, wheel: 0, droneSpeed: 0 });
    expect(s.locked).toBe(false);
    expect(s.weight).toBe(1);
  });

  it("locks for any wheel input, even with the scroll at rest", () => {
    const s = createLock();
    run(s, 2, still);
    stepLock(s, DT, { velocity: 0, wheel: 200, droneSpeed: 0 });
    expect(s.locked).toBe(true);
    // The input holds the lock for its tolerance, then the calm runs.
    run(s, 0.05, still);
    expect(s.locked).toBe(true);
  });

  it("stays locked while the drone has not settled, and opens when it has", () => {
    const s = createLock();
    run(s, 2, still);
    run(s, 0.3, { velocity: 1, wheel: 400, droneSpeed: 2 });
    expect(s.locked).toBe(true);
    run(s, 3, { velocity: 0, wheel: 0, droneSpeed: SETTLED * 2 });
    expect(s.locked).toBe(true);
    expect(s.weight).toBe(0);
    run(s, CALM_FOR + RAMP_UP + 0.2, { velocity: 0, wheel: 0, droneSpeed: SETTLED / 2 });
    expect(s.locked).toBe(false);
    expect(s.weight).toBe(1);
  });

  it("turns round from where it is when a scroll begins on the way up", () => {
    const s = createLock();
    run(s, CALM_FOR + 0.2, still);
    const before = s.weight;
    const w = stepLock(s, DT, { velocity: 1, wheel: 0, droneSpeed: 0 });
    expect(w).toBeLessThanOrEqual(before + 1e-9);
    // The weight never leaves 0 to 1 and the ramp is monotone while a direction holds.
    let last = w;
    for (let i = 0; i < 60; i += 1) {
      const next = stepLock(s, DT, { velocity: 1, wheel: 0, droneSpeed: 0 });
      expect(next).toBeLessThanOrEqual(last + 1e-9);
      expect(next).toBeGreaterThanOrEqual(0);
      last = next;
    }
  });

  it("a jump closes it with the weight at 0", () => {
    const s = createLock();
    run(s, 2, still);
    closeLock(s);
    expect(s.weight).toBe(0);
    expect(s.locked).toBe(true);
  });
});
