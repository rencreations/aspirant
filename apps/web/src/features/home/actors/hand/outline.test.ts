import { describe, expect, it } from "vitest";

import { smoothNormals } from "./outline";

describe("smoothNormals", () => {
  it("averages the normals of the vertices that share a place", () => {
    // Two vertices at one place with normals along +X and +Y, one vertex elsewhere.
    const positions = [0, 0, 0, 0, 0, 0, 5, 5, 5];
    const normals = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const out = smoothNormals(positions, normals);
    const s = Math.SQRT1_2;
    expect(out[0]).toBeCloseTo(s, 6);
    expect(out[1]).toBeCloseTo(s, 6);
    expect(out[3]).toBeCloseTo(s, 6);
    expect(out[4]).toBeCloseTo(s, 6);
    expect(Array.from(out.slice(6, 9))).toEqual([0, 0, 1]);
  });

  it("gives unit vectors", () => {
    const out = smoothNormals([0, 0, 0, 0, 0, 0, 1, 0, 0], [1, 1, 0, 1, 0, 1, 0, 1, 0]);
    for (let i = 0; i < 3; i += 1) {
      expect(Math.hypot(out[i * 3]!, out[i * 3 + 1]!, out[i * 3 + 2]!)).toBeCloseTo(1, 5);
    }
  });

  it("keeps a vertex's own normal where the normals at a place cancel", () => {
    const out = smoothNormals([0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, -1]);
    expect(Array.from(out)).toEqual([0, 0, 1, 0, 0, -1]);
  });

  it("copes with no vertices", () => {
    expect(smoothNormals([], []).length).toBe(0);
  });
});
