import { describe, expect, it } from "vitest";

import { gloveOffset, gloveGoal, glovePose, newGoal } from "./pose";

describe("gloveOffset", () => {
  const out = { x: 0, y: 0, z: 0 };

  it("with no turn the glove is where it rests", () => {
    gloveOffset(out, 1.7, -0.4, 0.5, 0, 0);
    expect(out).toEqual({ x: 1.7, y: -0.4, z: 0.5 });
  });

  it("a quarter roll turns the glove about the line of sight", () => {
    gloveOffset(out, 1, 0, 0.3, 0, Math.PI / 2);
    expect(out.x).toBeCloseTo(0, 9);
    expect(out.y).toBeCloseTo(1, 9);
    expect(out.z).toBeCloseTo(0.3, 9);
  });

  it("a quarter yaw swings a glove from the side to the front, and the front to the other side", () => {
    gloveOffset(out, 1, 0, 0, Math.PI / 2, 0);
    expect(out.x).toBeCloseTo(0, 9);
    expect(out.z).toBeCloseTo(-1, 9);
    gloveOffset(out, 0, 0, 1, Math.PI / 2, 0);
    expect(out.x).toBeCloseTo(1, 9);
    expect(out.z).toBeCloseTo(0, 9);
  });

  it("keeps the distance from the ball whatever the turn", () => {
    for (let k = 0; k < 40; k += 1) {
      gloveOffset(out, 1.7, -0.4, 0.5, k * 0.37, k * 0.21);
      expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(Math.hypot(1.7, 0.4, 0.5), 9);
    }
  });
});

describe("the empty goals", () => {
  it("a new goal has its own parts, not shared ones", () => {
    const a = newGoal();
    const b = newGoal();
    a.gl.x = 5;
    a.earL.splay = 1;
    expect(b.gl.x).toBe(0);
    expect(b.earL.splay).toBe(0);
    expect(gloveGoal()).not.toBe(gloveGoal());
    expect(glovePose().size).toBe(1);
  });
});
