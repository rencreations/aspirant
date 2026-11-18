import { describe, expect, it } from "vitest";

import { clientToStage, insideAny, newDiscs, project } from "./hit";

describe("discs", () => {
  it("a point inside a disc hits and one outside does not", () => {
    const discs = newDiscs(2);
    discs[0] = { x: 10, y: 10, r: 5 };
    expect(insideAny(discs, 12, 12)).toBe(true);
    expect(insideAny(discs, 20, 10)).toBe(false);
  });

  it("a disc with no radius never hits", () => {
    const discs = newDiscs(1);
    expect(insideAny(discs, 0, 0)).toBe(false);
  });
});

describe("clientToStage", () => {
  it("puts the middle of the window at the origin and y up", () => {
    const out = { x: 0, y: 0 };
    clientToStage(720, 450, 1440, 900, out);
    expect(out).toEqual({ x: 0, y: 0 });
    clientToStage(0, 0, 1440, 900, out);
    expect(out).toEqual({ x: -720, y: 450 });
  });
});

describe("project", () => {
  it("a point on the picture plane stays where it is", () => {
    const out = { x: 0, y: 0 };
    expect(project(120, -40, 0, 1000, out)).toBe(true);
    expect(out.x).toBeCloseTo(120, 9);
    expect(out.y).toBeCloseTo(-40, 9);
  });

  it("a nearer point is thrown farther from the middle", () => {
    const out = { x: 0, y: 0 };
    project(100, 0, 500, 1000, out);
    expect(out.x).toBeCloseTo(200, 9);
  });

  it("a point at or behind the camera is refused", () => {
    const out = { x: 0, y: 0 };
    expect(project(1, 1, 1000, 1000, out)).toBe(false);
    expect(project(1, 1, 1200, 1000, out)).toBe(false);
  });
});
