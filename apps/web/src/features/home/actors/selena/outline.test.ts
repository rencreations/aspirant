import { describe, expect, it } from "vitest";

import { outlineUnits, smoothNormals } from "./outline";

describe("smoothNormals", () => {
  it("averages the normals of vertices at one place and keeps unit length", () => {
    // Two vertices at the same place with normals along +x and +y, one alone with +z.
    const positions = [5, 5, 5, 5, 5, 5, 9, 9, 9];
    const normals = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const out = smoothNormals(positions, normals);
    const s = Math.SQRT1_2;
    expect(out[0]).toBeCloseTo(s, 6);
    expect(out[1]).toBeCloseTo(s, 6);
    expect(out[3]).toBeCloseTo(s, 6);
    expect(out[4]).toBeCloseTo(s, 6);
    expect(Array.from(out.slice(6, 9))).toEqual([0, 0, 1]);
  });

  it("keeps a vertex's own normal when the normals at its place cancel", () => {
    const out = smoothNormals([1, 1, 1, 1, 1, 1], [0, 0, 1, 0, 0, -1]);
    expect(Array.from(out)).toEqual([0, 0, 1, 0, 0, -1]);
  });

  it("is empty for no vertices", () => {
    expect(smoothNormals([], []).length).toBe(0);
  });
});

describe("outlineUnits", () => {
  it("is the screen width over the pixels a metre has, clamped", () => {
    expect(outlineUnits(1.6, 800, 1, 0.0014, 0.006)).toBeCloseTo(0.002, 6);
    // A tiny figure: the line would be wider than the most allowed.
    expect(outlineUnits(1.6, 100, 1, 0.0014, 0.006)).toBe(0.006);
    // A huge figure: never thinner than the least.
    expect(outlineUnits(1.6, 5000, 1, 0.0014, 0.006)).toBe(0.0014);
  });

  it("follows the mesh's units and survives a bad scale", () => {
    expect(outlineUnits(1.6, 800, 2, 0.0014, 0.006)).toBeCloseTo(0.004, 6);
    expect(outlineUnits(1.6, 0, 1, 0.0014, 0.006)).toBe(0.006);
  });
});
