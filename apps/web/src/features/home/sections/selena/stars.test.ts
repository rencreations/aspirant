import { describe, expect, it } from "vitest";

import { starField } from "./stars";

describe("the stars of the sky", () => {
  it("are the same list every time (the server and the client agree)", () => {
    expect(starField(46)).toEqual(starField(46));
  });

  it("stay inside the box, small and dim enough not to be noise", () => {
    const stars = starField(46);
    expect(stars).toHaveLength(46);
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(100);
      expect(s.r).toBeGreaterThan(0.05);
      expect(s.r).toBeLessThan(0.5);
      expect(s.o).toBeGreaterThan(0.2);
      expect(s.o).toBeLessThanOrEqual(0.9);
    }
  });

  it("do not all sit on one spot", () => {
    const xs = new Set(starField(46).map((s) => s.x));
    expect(xs.size).toBeGreaterThan(40);
  });
});
