import { describe, expect, it } from "vitest";

import { pressureAt, samplePath, strokeOutline } from "./signature-outline";
import { SIGNATURE } from "./signature-paths";

describe("signature outline", () => {
  it("samples evenly from the first point to the last", () => {
    const pts = samplePath("M0 0 C10 0 20 0 30 0", 7);
    expect(pts).toHaveLength(7);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[6]?.[0]).toBeCloseTo(30, 3);
    expect(pts[3]?.[0]).toBeCloseTo(15, 1);
  });

  it("reads the pressure smoothly between its marks", () => {
    expect(pressureAt([0, 1], 0)).toBe(0);
    expect(pressureAt([0, 1], 1)).toBe(1);
    expect(pressureAt([0, 1], 0.5)).toBeCloseTo(0.5, 5);
    expect(pressureAt([0.3, 1, 0.1], 0.5)).toBeCloseTo(1, 5);
  });

  it("draws a closed, tapered shape for every stroke", () => {
    for (const s of SIGNATURE) {
      const d = strokeOutline(s.d, s.width, s.press);
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      expect(d).not.toContain("NaN");
    }
  });

  it("is wider at full pressure than at the ends", () => {
    const thin = strokeOutline("M0 0 C10 0 20 0 30 0", 10, [0.1, 1, 0.1], 1, 31);
    const ys = [...thin.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(8);
  });
});
