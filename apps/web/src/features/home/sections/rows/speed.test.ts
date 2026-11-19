import { describe, expect, it } from "vitest";

import { BOOST_MAX, DWELL_DARK, IDLE_RATE, groundDark, rowsRate } from "./speed";

describe("the rows' speed", () => {
  it("never stops: the idle glide is the least", () => {
    expect(rowsRate(0)).toBe(IDLE_RATE);
    for (const w of [-5000, -300, 0, 12, 300, 5000])
      expect(rowsRate(w)).toBeGreaterThanOrEqual(IDLE_RATE);
  });

  it("goes faster with the scroll in either direction, and is capped", () => {
    expect(rowsRate(600)).toBeGreaterThan(rowsRate(100));
    expect(rowsRate(-600)).toBe(rowsRate(600));
    expect(rowsRate(1e6)).toBe(IDLE_RATE + BOOST_MAX);
  });
});

describe("the ground", () => {
  it("is daybreak at the start, goes a little dark through the dwell, and the play finishes it", () => {
    expect(groundDark(0, 0, 0.2, 1.5)).toBe(0);
    expect(groundDark(1, 0, 0.2, 1.5)).toBeCloseTo(DWELL_DARK, 12);
    expect(groundDark(1, 2.4, 0.2, 1.5)).toBeCloseTo(1, 12);
  });

  it("does not step where the play takes over, and never goes back while it plays", () => {
    let last = groundDark(1, 0, 0.2, 1.5);
    for (let s = 0; s <= 2.4; s += 0.01) {
      const g = groundDark(1, s, 0.2, 1.5);
      expect(g).toBeGreaterThanOrEqual(last - 1e-12);
      expect(g - last).toBeLessThan(0.05);
      last = g;
    }
  });

  it("follows the scroll through the dwell and back", () => {
    expect(groundDark(0.5, 0, 0.2, 1.5)).toBeLessThan(groundDark(1, 0, 0.2, 1.5));
    expect(groundDark(-1, 0, 0.2, 1.5)).toBe(0);
    expect(groundDark(3, 0, 0.2, 1.5)).toBeCloseTo(DWELL_DARK, 12);
  });
});
