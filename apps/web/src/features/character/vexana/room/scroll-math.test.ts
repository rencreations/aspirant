import { describe, expect, it } from "vitest";

import { ARM_AT, BAR_AT, DEAD, meters, recentInput, trackProgress } from "./scroll-math";

describe("trackProgress", () => {
  it("is 0 before the track moves and 1 at its end", () => {
    expect(trackProgress(0, 3000, 1000)).toBe(0);
    expect(trackProgress(-1000, 3000, 1000)).toBe(0.5);
    expect(trackProgress(-2000, 3000, 1000)).toBe(1);
    expect(trackProgress(-2600, 3000, 1000)).toBe(1);
    expect(trackProgress(400, 3000, 1000)).toBe(0);
  });

  it("is 0 for a track no taller than the screen", () => {
    expect(trackProgress(-50, 900, 1000)).toBe(0);
  });
});

describe("meters", () => {
  it("does nothing in the quiet stretch", () => {
    const m = meters(DEAD / 2);
    expect(m.strength).toBe(0);
    expect(m.bar).toBe(false);
    expect(m.ahead).toBe(0);
    expect(m.armed).toBe(false);
  });

  it("raises the strength meter, and opens the bar when it is full", () => {
    const half = meters((DEAD + BAR_AT) / 2);
    expect(half.strength).toBeCloseTo(0.5);
    expect(half.bar).toBe(false);
    const full = meters(BAR_AT);
    expect(full.strength).toBe(1);
    expect(full.bar).toBe(true);
    expect(full.ahead).toBe(0);
  });

  it("fills the bar's meter, and arms at the end", () => {
    const mid = meters((BAR_AT + ARM_AT) / 2, true);
    expect(mid.ahead).toBeCloseTo(0.5);
    expect(mid.armed).toBe(false);
    const end = meters(ARM_AT, true);
    expect(end.ahead).toBe(1);
    expect(end.armed).toBe(true);
  });

  it("keeps the bar up a little way back down, then closes it", () => {
    expect(meters(BAR_AT - 0.02, true).bar).toBe(true);
    expect(meters(BAR_AT - 0.02, false).bar).toBe(false);
    expect(meters(BAR_AT - 0.2, true).bar).toBe(false);
  });
});

describe("recentInput", () => {
  it("counts a scroll input a moment ago", () => {
    expect(recentInput(10_000, 8_000)).toBe(true);
  });
  it("does not count an input long ago, or none at all", () => {
    expect(recentInput(10_000, 1_000)).toBe(false);
    expect(recentInput(10_000, -Infinity)).toBe(false);
  });
});
