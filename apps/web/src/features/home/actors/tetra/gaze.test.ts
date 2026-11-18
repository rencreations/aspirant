import { describe, expect, it } from "vitest";

import { gazeFor } from "./gaze";

describe("her gaze", () => {
  it("turns toward a point at the side and nods toward a point below", () => {
    const g = { yaw: 0, nod: 0 };
    gazeFor(700, 300, 500, 300, 300, g);
    expect(g.yaw).toBeGreaterThan(0.1);
    expect(Math.abs(g.nod)).toBeLessThan(1e-9);
    gazeFor(300, 300, 500, 300, 300, g);
    expect(g.yaw).toBeLessThan(-0.1);
    gazeFor(500, 500, 500, 300, 300, g);
    expect(g.nod).toBeGreaterThan(0.1);
  });

  it("never turns more than her neck does", () => {
    const g = { yaw: 0, nod: 0 };
    for (const px of [-1e4, -300, 0, 300, 1e4]) {
      gazeFor(px, 100, 0, 0, 300, g);
      expect(Math.abs(g.yaw)).toBeLessThanOrEqual(0.52 + 1e-9);
      expect(Math.abs(g.nod)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it("lets go of a point far across the page", () => {
    const g = { yaw: 0, nod: 0 };
    const near = gazeFor(300, 0, 0, 0, 300, g);
    expect(near).toBe(1);
    const far = gazeFor(2000, 0, 0, 0, 300, g);
    expect(far).toBe(0);
    expect(g.yaw).toBe(0);
  });
});
