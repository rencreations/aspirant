import { describe, expect, it } from "vitest";

import {
  clientToScreen,
  defaultYaw,
  depthScale,
  isJump,
  placeToTarget,
  STAGE_DEPTH,
  type Target,
} from "./coords";
import { SIZE_PER_HEIGHT } from "./model";

const blank = (): Target => ({ x: 0, y: 0, size: 0, yaw: 0, pitch: 0, roll: 0 });

describe("placeToTarget", () => {
  it("flips y and gives the About size for a height", () => {
    const t = placeToTarget({ x: 100, y: 50, height: 160 }, 1440, blank());
    expect(t.x).toBe(100);
    expect(t.y).toBe(-50);
    expect(t.size).toBeCloseTo(160 * SIZE_PER_HEIGHT, 6);
  });

  it("about 1.386 times the height, as the About page sizes by the width of the model", () => {
    expect(SIZE_PER_HEIGHT).toBeGreaterThan(1.38);
    expect(SIZE_PER_HEIGHT).toBeLessThan(1.39);
  });

  it("magnifies and moves outward a drone nearer the camera", () => {
    const flat = placeToTarget({ x: 200, y: 100, height: 100 }, 1000, blank());
    const near = placeToTarget({ x: 200, y: 100, z: 500, height: 100 }, 1000, blank());
    expect(depthScale(500)).toBeCloseTo(2, 6);
    expect(near.x).toBeCloseTo(flat.x * 2, 6);
    expect(near.y).toBeCloseTo(flat.y * 2, 6);
    expect(near.size).toBeCloseTo(flat.size * 2, 6);
  });

  it("never divides by zero at or beyond the camera", () => {
    expect(Number.isFinite(depthScale(STAGE_DEPTH))).toBe(true);
    expect(Number.isFinite(depthScale(STAGE_DEPTH * 5))).toBe(true);
    expect(depthScale(-500)).toBeCloseTo(1 / 1.5, 6);
  });

  it("uses the attitude it is given and a face toward the middle otherwise", () => {
    const given = placeToTarget(
      { x: 0, y: 0, height: 100, yaw: 0.2, pitch: 0.1, roll: -0.3 },
      1000,
      blank(),
    );
    expect([given.yaw, given.pitch, given.roll]).toEqual([0.2, 0.1, -0.3]);
    const left = placeToTarget({ x: -400, y: 0, height: 100 }, 1000, blank());
    const right = placeToTarget({ x: 400, y: 0, height: 100 }, 1000, blank());
    expect(left.yaw).toBeGreaterThan(0);
    expect(right.yaw).toBeLessThan(0);
    expect(defaultYaw(0, 1000)).toBeCloseTo(0, 9);
    expect(Math.abs(defaultYaw(5000, 1000))).toBeLessThanOrEqual(0.38 + 1e-9);
  });
});

describe("the screen frame", () => {
  it("turns a client point into the middle-origin frame", () => {
    const p = clientToScreen(720, 300, 1440, 900, { x: 0, y: 0 });
    expect(p).toEqual({ x: 0, y: -150 });
  });

  it("calls a step of nearly a whole diagonal a jump and a short step not", () => {
    expect(isJump({ x: 0, y: 0 }, { x: 50, y: 40 }, 1440, 900)).toBe(false);
    expect(isJump({ x: 0, y: 0 }, { x: 1000, y: 0 }, 1440, 900)).toBe(false);
    expect(isJump({ x: -700, y: -400 }, { x: 700, y: 400 }, 1440, 900)).toBe(true);
  });
});
