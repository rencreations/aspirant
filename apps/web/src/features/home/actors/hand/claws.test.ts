import { describe, expect, it } from "vitest";

import { clawWeight } from "./claws";

describe("clawWeight", () => {
  it("is 0 on the finger and 1 out on the claw", () => {
    expect(clawWeight(0.01, 0.1, 0.34, 0.44)).toBe(0);
    expect(clawWeight(0.09, 0.1, 0.34, 0.44)).toBe(1);
  });

  it("has a soft edge between the two shares", () => {
    const mid = clawWeight(0.039, 0.1, 0.34, 0.44);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(clawWeight(0.039, 0.1, 0.34, 0.44)).toBeCloseTo(0.5, 5);
  });

  it("rises with the distance", () => {
    let last = -1;
    for (let a = 0; a <= 0.1; a += 0.005) {
      const w = clawWeight(a, 0.1, 0.34, 0.44);
      expect(w).toBeGreaterThanOrEqual(last);
      last = w;
    }
  });

  it("is 0 for a bone with no reach and for a vertex behind the head", () => {
    expect(clawWeight(0.05, 0, 0.34, 0.44)).toBe(0);
    expect(clawWeight(-0.02, 0.1, 0.34, 0.44)).toBe(0);
  });
});
