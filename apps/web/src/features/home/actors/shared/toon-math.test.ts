import { describe, expect, it } from "vitest";

import {
  bandWeights,
  outlineFor,
  shadeOf,
  smoothNormals,
  tuneLook,
  weldStep,
  type ToonLookSpec,
} from "./toon-math";

const LOOK: ToonLookSpec = {
  bands: 3,
  cut: [-0.2, 0.1],
  soft: 0.04,
  shade: [0.6, 0.7, 0.95],
  deep: [0.4, 0.5, 0.8],
  lit: [1, 1, 1],
  sat: 1.2,
  rim: 0.5,
  rimWidth: 0.3,
  glint: 0,
  glintSize: 0.97,
};

describe("smoothNormals", () => {
  it("averages the normals of vertices at one place and keeps unit length", () => {
    const positions = [5, 5, 5, 5, 5, 5, 9, 9, 9];
    const normals = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const out = smoothNormals(positions, normals);
    const s = Math.SQRT1_2;
    expect(out[0]).toBeCloseTo(s, 6);
    expect(out[1]).toBeCloseTo(s, 6);
    expect(out[3]).toBeCloseTo(s, 6);
    expect(Array.from(out.slice(6, 9))).toEqual([0, 0, 1]);
  });

  it("keeps a vertex own normal when the normals at its place cancel", () => {
    const out = smoothNormals([1, 1, 1, 1, 1, 1], [0, 0, 1, 0, 0, -1]);
    expect(Array.from(out)).toEqual([0, 0, 1, 0, 0, -1]);
  });

  it("welds places that differ by less than the step", () => {
    const positions = [1, 1, 1, 1.00001, 1, 1];
    const normals = [1, 0, 0, 0, 1, 0];
    const exact = smoothNormals(positions, normals);
    expect(exact[0]).toBe(1);
    const welded = smoothNormals(positions, normals, 0.001);
    expect(welded[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(welded[3]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("is empty for no vertices", () => {
    expect(smoothNormals([], []).length).toBe(0);
  });
});

describe("weldStep", () => {
  it("is a hundred thousandth of the size and zero for nothing", () => {
    expect(weldStep(2)).toBeCloseTo(2e-5, 10);
    expect(weldStep(0)).toBe(0);
  });
});

describe("outlineFor", () => {
  it("is 1.2 px for a small figure and thicker as it grows", () => {
    expect(outlineFor(120).px).toBeCloseTo(1.2, 6);
    expect(outlineFor(40).px).toBe(1.2);
    expect(outlineFor(400).px).toBeGreaterThan(1.7);
    expect(outlineFor(400).px).toBeLessThan(2);
    expect(outlineFor(900).px).toBeGreaterThan(2.7);
    expect(outlineFor(900).px).toBeLessThan(3.1);
  });

  it("never goes past 3.5 px and survives a bad height", () => {
    expect(outlineFor(5000).px).toBe(3.5);
    expect(outlineFor(-5).px).toBe(1.2);
    expect(Number.isFinite(outlineFor(Number.NaN).px)).toBe(true);
  });

  it("pushes the hull back by a thin share of the height, at least a little", () => {
    expect(outlineFor(1000).push).toBeCloseTo(1.2, 6);
    expect(outlineFor(10).push).toBe(0.1);
  });

  it("writes into the object it is given", () => {
    const out = { px: 0, push: 0, card: 0 };
    expect(outlineFor(600, out)).toBe(out);
    expect(out.px).toBeGreaterThan(2);
  });
});

describe("shadeOf", () => {
  it("is cooler than the albedo for a cool tint", () => {
    const albedo = [0.8, 0.6, 0.5] as const;
    const shade = shadeOf(albedo, [0.6, 0.7, 0.95], 1.2);
    expect(shade[2] / shade[0]).toBeGreaterThan(albedo[2] / albedo[0]);
    expect(shade[0]).toBeLessThan(albedo[0]);
  });

  it("keeps the tinted colour at a saturation of one and pushes it from grey above one", () => {
    const flat = shadeOf([0.5, 0.4, 0.3], [1, 1, 1], 1);
    expect(flat[0]).toBeCloseTo(0.5, 6);
    const pushed = shadeOf([0.5, 0.4, 0.3], [1, 1, 1], 1.5);
    expect(pushed[0] - pushed[2]).toBeGreaterThan(0.2);
  });
});

describe("bandWeights", () => {
  it("is all lit well past the lit step and all deep well before the deep one (three bands)", () => {
    expect(bandWeights(0.8, LOOK)).toEqual([0, 0, 1]);
    expect(bandWeights(-0.9, LOOK)).toEqual([1, 0, 0]);
  });

  it("is the shade between the two steps", () => {
    const w = bandWeights(-0.05, LOOK);
    expect(w[1]).toBe(1);
  });

  it("has two bands when asked: shade and lit only", () => {
    const two = { ...LOOK, bands: 2 as const };
    expect(bandWeights(-0.9, two)).toEqual([0, 1, 0]);
    expect(bandWeights(0.9, two)).toEqual([0, 0, 1]);
  });

  it("makes the edge crisp: the change takes about twice the softness, no more", () => {
    const edge = LOOK.cut[1];
    expect(bandWeights(edge - LOOK.soft, LOOK)[2]).toBe(0);
    expect(bandWeights(edge + LOOK.soft, LOOK)[2]).toBe(1);
    expect(bandWeights(edge, LOOK)[2]).toBeCloseTo(0.5, 6);
  });

  it("always sums to one", () => {
    for (let d = -1; d <= 1; d += 0.07) {
      const w = bandWeights(d, LOOK);
      expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 9);
    }
  });
});

describe("tuneLook", () => {
  it("returns the base itself with no overrides and a merged copy otherwise", () => {
    expect(tuneLook(LOOK)).toBe(LOOK);
    const tuned = tuneLook(LOOK, { soft: 0.1 });
    expect(tuned.soft).toBe(0.1);
    expect(tuned.sat).toBe(LOOK.sat);
    expect(LOOK.soft).toBe(0.04);
  });
});

describe("outlineFor card line", () => {
  it("is a fine share of the line for a small figure and at most 0.5 for a big one", () => {
    expect(outlineFor(120).card).toBeLessThan(0.25);
    expect(outlineFor(240).card).toBeLessThan(0.3);
    expect(outlineFor(900).card).toBeLessThan(0.5);
    expect(outlineFor(2000).card).toBe(0.5);
    expect(outlineFor(0).card).toBeGreaterThan(0);
  });
});
