import { describe, expect, it } from "vitest";

import { WheelSteps, wheelDelta } from "./wheel";

/** Feed events `[time, delta]` and return the steps they made. */
function run(events: Array<[number, number]>, stepper = new WheelSteps()): number[] {
  const steps: number[] = [];
  for (const [t, d] of events) {
    const s = stepper.push(d, t);
    if (s) steps.push(s);
  }
  return steps;
}

describe("wheel steps", () => {
  it("makes one step for one notch of a mouse wheel", () => {
    expect(run([[1000, 100]])).toEqual([1]);
    expect(run([[1000, -100]])).toEqual([-1]);
  });

  it("makes a step for each notch of a wheel turned on", () => {
    const notches: Array<[number, number]> = [0, 120, 240, 360].map((t) => [1000 + t, 100]);
    expect(run(notches)).toEqual([1, 1, 1, 1]);
  });

  it("makes one step for a trackpad flick, not one per event of its momentum", () => {
    const events: Array<[number, number]> = [];
    let size = 60;
    for (let t = 0; t < 900; t += 16) {
      events.push([1000 + t, size]);
      size *= 0.93;
    }
    expect(run(events)).toEqual([1]);
  });

  it("keeps stepping, calmly, through a long steady swipe", () => {
    const events: Array<[number, number]> = [];
    for (let t = 0; t <= 1200; t += 16) events.push([1000 + t, 20]);
    const steps = run(events);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.length).toBeLessThanOrEqual(4);
  });

  it("counts a second flick after the first has faded", () => {
    const events: Array<[number, number]> = [];
    let size = 50;
    for (let t = 0; t < 300; t += 16) {
      events.push([1000 + t, size]);
      size *= 0.85;
    }
    size = 70;
    for (let t = 320; t < 600; t += 16) {
      events.push([1000 + t, size]);
      size *= 0.85;
    }
    expect(run(events)).toEqual([1, 1]);
  });

  it("ignores tiny movements and starts fresh after a pause", () => {
    expect(
      run([
        [1000, 0.1],
        [1010, 0.2],
      ]),
    ).toEqual([]);
    const s = new WheelSteps();
    expect(run([[1000, 100]], s)).toEqual([1]);
    expect(run([[2000, -100]], s)).toEqual([-1]);
  });

  it("reads lines and pages as pixels, and takes the larger axis", () => {
    const view = { width: 1440, height: 900 };
    expect(wheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }, view)).toBe(48);
    expect(wheelDelta({ deltaX: 0, deltaY: 1, deltaMode: 2 }, view)).toBe(900);
    expect(wheelDelta({ deltaX: 80, deltaY: 10, deltaMode: 0 }, view)).toBe(80);
    expect(wheelDelta({ deltaX: 10, deltaY: -40, deltaMode: 0 }, view)).toBe(-40);
  });
});
