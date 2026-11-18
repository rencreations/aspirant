import { describe, expect, it } from "vitest";

import { carryScript } from "./carry-script";

describe("carryScript", () => {
  it("stays inside the ranges the duo takes, at every time and every help", () => {
    for (let t = -1; t <= 8; t += 0.05) {
      for (const help of [0, 0.3, 1, 2, -1]) {
        const s = carryScript(t, help);
        expect(s.tension).toBeGreaterThanOrEqual(0);
        expect(s.tension).toBeLessThanOrEqual(1);
        expect(s.struggle).toBeGreaterThanOrEqual(0);
        expect(s.struggle).toBeLessThanOrEqual(1);
        expect(s.lift).toBeGreaterThanOrEqual(-1);
        expect(s.lift).toBeLessThanOrEqual(1);
      }
    }
  });

  it("they drop it once: the lift falls below zero around the third second", () => {
    const low = Math.min(...Array.from({ length: 200 }, (_, i) => carryScript(i * 0.03).lift));
    expect(low).toBeLessThan(-0.4);
    expect(carryScript(2.6).lift).toBeLessThan(0);
  });

  it("help takes the strain away and lifts the payload", () => {
    const alone = carryScript(3.9, 0);
    const helped = carryScript(3.9, 1);
    expect(helped.struggle).toBeLessThan(alone.struggle * 0.3);
    expect(helped.tension).toBeLessThan(alone.tension);
    expect(helped.lift).toBeGreaterThan(0);
  });
});
