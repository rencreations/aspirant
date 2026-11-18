import { describe, expect, it } from "vitest";

import { solveTwoBone, type Elbow, type Vec3 } from "./ik";

const out = (): Elbow => ({ x: 0, y: 0, z: 0, reached: 0 });
const dist = (p: Vec3, q: Vec3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

describe("two-bone solve", () => {
  const shoulder = { x: 0.1, y: 0.4, z: 0 };
  const a = 0.12;
  const b = 0.1;

  it("keeps both bones their length for a point in reach", () => {
    const goal = { x: 0.2, y: 0.3, z: 0.1 };
    const e = solveTwoBone(shoulder, goal, { x: 1, y: -1, z: 0 }, a, b, out());
    expect(dist(shoulder, e)).toBeCloseTo(a, 6);
    expect(dist(e, goal)).toBeCloseTo(b, 6);
    expect(e.reached).toBe(1);
  });

  it("stretches the arm straight at a point out of reach and says how short it fell", () => {
    const goal = { x: 1, y: 0.4, z: 0 };
    const e = solveTwoBone(shoulder, goal, { x: 0, y: -1, z: 0 }, a, b, out());
    expect(dist(shoulder, e)).toBeCloseTo(a, 5);
    // The elbow lies on the line to the point.
    expect(e.y).toBeCloseTo(0.4, 3);
    expect(e.x).toBeCloseTo(shoulder.x + a, 4);
    expect(e.reached).toBeCloseTo((a + b) / 0.9, 3);
    expect(e.reached).toBeLessThan(1);
  });

  it("bends the elbow toward the hint, and the other way for the opposite hint", () => {
    const goal = { x: 0.1, y: 0.28, z: 0.12 };
    const down = solveTwoBone(shoulder, goal, { x: 0, y: -1, z: 0 }, a, b, out());
    const up = solveTwoBone(shoulder, goal, { x: 0, y: 1, z: 0 }, a, b, out());
    expect(down.y).toBeLessThan(up.y);
    expect(dist(shoulder, up)).toBeCloseTo(a, 6);
    expect(dist(up, goal)).toBeCloseTo(b, 6);
  });

  it("is finite for a hint along the line, a point on the shoulder and a point too near", () => {
    const cases: Array<[Vec3, Vec3]> = [
      [
        { x: 0.1, y: 0.2, z: 0 },
        { x: 0, y: -1, z: 0 },
      ],
      [shoulder, { x: 0, y: -1, z: 0 }],
      [
        { x: 0.1, y: 0.39, z: 0.001 },
        { x: 0, y: 0, z: 0 },
      ],
    ];
    for (const [goal, pole] of cases) {
      const e = solveTwoBone(shoulder, goal, pole, a, b, out());
      expect([e.x, e.y, e.z, e.reached].every(Number.isFinite)).toBe(true);
      expect(dist(shoulder, e)).toBeCloseTo(a, 5);
    }
  });
});
