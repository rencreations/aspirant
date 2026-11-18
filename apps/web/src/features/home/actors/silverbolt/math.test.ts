import { describe, expect, it } from "vitest";

import {
  clamp,
  clampDepth,
  clipJumped,
  damp,
  facing,
  lerp,
  perspectiveFactor,
  scaleForHeight,
  smoothstep,
  softClamp,
  springSnap,
  springStep,
  unprojectToDepth,
  wrapAngle,
} from "./math";

describe("easing helpers", () => {
  it("clamp, lerp and smoothstep behave at the ends", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(smoothstep(0, 10, -1)).toBe(0);
    expect(smoothstep(0, 10, 11)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
  });

  it("damp is frame rate independent", () => {
    const whole = damp(0, 1, 6, 0.1);
    const half = damp(damp(0, 1, 6, 0.05), 1, 6, 0.05);
    expect(whole).toBeCloseTo(half, 12);
    expect(damp(0, 1, 6, 0)).toBe(0);
  });

  it("softClamp follows the input near zero and never passes its limit", () => {
    expect(softClamp(0.01, 0.5)).toBeCloseTo(0.01, 3);
    expect(softClamp(100, 0.5)).toBeLessThanOrEqual(0.5);
    expect(softClamp(-100, 0.5)).toBeGreaterThanOrEqual(-0.5);
    expect(softClamp(1, 0)).toBe(0);
  });
});

describe("springs", () => {
  it("settles on its target and stops", () => {
    const s = { x: 0, v: 0 };
    for (let i = 0; i < 120; i++) springStep(s, 1, 10, 1, 1 / 60);
    expect(s.x).toBeCloseTo(1, 4);
    expect(Math.abs(s.v)).toBeLessThan(1e-3);
  });

  it("an under damped spring overshoots, a critical one does not", () => {
    const under = { x: 0, v: 0 };
    const crit = { x: 0, v: 0 };
    let maxUnder = 0;
    let maxCrit = 0;
    for (let i = 0; i < 120; i++) {
      springStep(under, 1, 14, 0.4, 1 / 60);
      springStep(crit, 1, 14, 1, 1 / 60);
      maxUnder = Math.max(maxUnder, under.x);
      maxCrit = Math.max(maxCrit, crit.x);
    }
    expect(maxUnder).toBeGreaterThan(1.05);
    expect(maxCrit).toBeLessThanOrEqual(1.0001);
  });

  it("does nothing for a zero step and stays finite for a huge one", () => {
    const s = { x: 0.3, v: 2 };
    springStep(s, 1, 20, 0.5, 0);
    expect(s).toEqual({ x: 0.3, v: 2 });
    springStep(s, 1, 20, 0.5, 5);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.v)).toBe(true);
  });

  it("springSnap puts it at rest", () => {
    const s = { x: 3, v: 9 };
    springSnap(s, 0);
    expect(s).toEqual({ x: 0, v: 0 });
  });
});

describe("the pixel camera", () => {
  it("a point at the picture plane keeps its size, a near one is larger", () => {
    expect(perspectiveFactor(0, 1000)).toBe(1);
    expect(perspectiveFactor(500, 1000)).toBe(2);
  });

  it("scaleForHeight makes the block that many pixels tall at its depth", () => {
    const camZ = 1000;
    for (const z of [-300, 0, 400, 900]) {
      const scale = scaleForHeight(300, z, camZ, 1);
      expect(scale * 1 * perspectiveFactor(z, camZ)).toBeCloseTo(300, 6);
    }
  });

  it("clampDepth keeps the dragon in front of the near plane", () => {
    expect(clampDepth(5000, 1000)).toBeCloseTo(985);
    expect(clampDepth(100, 1000)).toBe(100);
  });

  it("unprojectToDepth is the inverse of the projection", () => {
    const out = { x: 0, y: 0 };
    unprojectToDepth(200, -100, 500, 1000, out);
    expect(out.x * perspectiveFactor(500, 1000)).toBeCloseTo(200);
    expect(out.y * perspectiveFactor(500, 1000)).toBeCloseTo(-100);
  });
});

describe("facing", () => {
  it("turns the head toward a heading drawn on the screen", () => {
    const right = facing(1, 0, 0);
    expect(right.yaw).toBeCloseTo(Math.PI / 2);
    expect(right.pitch).toBeCloseTo(0);
    const up = facing(0, 1, 0);
    expect(up.pitch).toBeCloseTo(Math.PI / 2);
    const lens = facing(1, 1, 1);
    expect(lens.yaw).toBeCloseTo(0);
    expect(lens.pitch).toBeCloseTo(0);
    expect(facing(-1, 0, 0).yaw).toBeCloseTo(-Math.PI / 2);
  });
});

describe("wrapAngle", () => {
  it("wraps into (-PI, PI]", () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1);
    expect(wrapAngle(0.3)).toBeCloseTo(0.3);
  });
});

describe("clipJumped", () => {
  it("is false for a normal frame and true for a scrub", () => {
    expect(clipJumped(1, 1.016, 6, false)).toBe(false);
    expect(clipJumped(1.5, 3.73, 6.29, false)).toBe(true);
  });

  it("counts the short way round a loop", () => {
    expect(clipJumped(2.7, 0.02, 2.708, true)).toBe(false);
    expect(clipJumped(2.7, 0.02, 2.708, false)).toBe(true);
    expect(clipJumped(0.1, 1.4, 2.708, true)).toBe(true);
  });
});
