import { describe, expect, it } from "vitest";

import { LIMITS, emptyGaze, gazeAngles, splitGaze } from "./look";

describe("gazeAngles", () => {
  it("is zero straight ahead, positive to +x and up", () => {
    expect(gazeAngles(0, 0, 1)).toEqual({ yaw: 0, pitch: 0 });
    expect(gazeAngles(1, 0, 1).yaw).toBeCloseTo(Math.PI / 4, 6);
    expect(gazeAngles(0, 1, 1).pitch).toBeCloseTo(Math.PI / 4, 6);
    expect(gazeAngles(-1, 0, 1).yaw).toBeLessThan(0);
  });
});

describe("splitGaze", () => {
  it("a small turn is the eyes alone", () => {
    const g = splitGaze(0.08, -0.05, emptyGaze());
    expect(g.headYaw).toBe(0);
    expect(g.neckYaw).toBe(0);
    expect(g.eyeYaw).toBeCloseTo(0.08, 6);
    expect(g.eyePitch).toBeCloseTo(-0.05, 6);
  });

  it("a larger turn brings the head and the neck, and the parts add up near the wish", () => {
    const g = splitGaze(0.5, 0.2, emptyGaze());
    expect(g.headYaw).toBeGreaterThan(0);
    expect(g.neckYaw).toBeGreaterThan(0);
    expect(g.headYaw).toBeGreaterThan(g.neckYaw);
    expect(g.neckYaw + g.headYaw + g.eyeYaw).toBeCloseTo(0.5, 6);
  });

  it("never passes the limits, for any cursor", () => {
    const g = emptyGaze();
    for (const yaw of [-3, -1.5, 1.5, 3]) {
      for (const pitch of [-1.5, 1.5]) {
        splitGaze(yaw, pitch, g);
        expect(Math.abs(g.neckYaw + g.headYaw)).toBeLessThanOrEqual(LIMITS.headYaw + 1e-9);
        expect(Math.abs(g.eyeYaw)).toBeLessThanOrEqual(LIMITS.eyeYaw + 1e-9);
        expect(g.neckPitch + g.headPitch).toBeLessThanOrEqual(LIMITS.headUp + 1e-9);
        expect(g.neckPitch + g.headPitch).toBeGreaterThanOrEqual(-LIMITS.headDown - 1e-9);
        expect(g.eyePitch).toBeLessThanOrEqual(LIMITS.eyeUp + 1e-9);
        expect(g.eyePitch).toBeGreaterThanOrEqual(-LIMITS.eyeDown - 1e-9);
      }
    }
  });

  it("is monotone in the wish and symmetric", () => {
    let last = -1;
    for (let yaw = 0; yaw <= 1.2; yaw += 0.05) {
      const g = splitGaze(yaw, 0, emptyGaze());
      const total = g.neckYaw + g.headYaw + g.eyeYaw;
      expect(total).toBeGreaterThanOrEqual(last - 1e-9);
      last = total;
    }
    const a = splitGaze(0.4, 0.1, emptyGaze());
    const b = splitGaze(-0.4, -0.1, emptyGaze());
    expect(b.headYaw).toBeCloseTo(-a.headYaw, 9);
    expect(b.eyeYaw).toBeCloseTo(-a.eyeYaw, 9);
  });
});
