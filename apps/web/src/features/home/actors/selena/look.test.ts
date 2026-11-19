import { describe, expect, it } from "vitest";

import { GENTLE, emptyGaze, gentleGaze } from "./look";

describe("gentleGaze", () => {
  it("is zero with the cursor on her eyes", () => {
    expect(gentleGaze(0, 0, emptyGaze())).toEqual(emptyGaze());
  });

  it("follows the cursor: right and up are positive", () => {
    const g = gentleGaze(0.5, 0.5, emptyGaze());
    expect(g.headYaw).toBeGreaterThan(0);
    expect(g.headPitch).toBeGreaterThan(0);
    expect(g.eyeYaw).toBeGreaterThan(0);
    const l = gentleGaze(-0.5, -0.5, emptyGaze());
    expect(l.headYaw).toBeCloseTo(-g.headYaw, 9);
    expect(l.eyePitch).toBeCloseTo(-g.eyePitch, 9);
  });

  it("is small: about 8 degrees of head sideways and 5 up, whatever the cursor does", () => {
    const deg = (r: number): number => (r * 180) / Math.PI;
    const g = emptyGaze();
    for (const v of [-9, -1, 1, 9]) {
      gentleGaze(v, v, g);
      expect(deg(Math.abs(g.headYaw))).toBeLessThanOrEqual(8.1);
      expect(deg(Math.abs(g.headPitch))).toBeLessThanOrEqual(5.2);
      expect(Math.abs(g.eyeYaw)).toBeLessThanOrEqual(GENTLE.eyeYaw + 1e-9);
    }
  });

  it("makes the eyes lead the head", () => {
    const g = gentleGaze(0.6, 0.6, emptyGaze());
    expect(g.eyeYaw).toBeGreaterThan(g.headYaw);
    expect(g.eyePitch).toBeGreaterThan(g.headPitch);
  });
});
