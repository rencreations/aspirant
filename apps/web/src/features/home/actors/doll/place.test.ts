import { describe, expect, it } from "vitest";

import {
  CAMERA_DISTANCE,
  DOLL_SIZE,
  clientToStage,
  depthScale,
  drawnHeight,
  fitScale,
  hitDepth,
  insideCapsule,
  insideCircle,
  projectToStage,
  rootScale,
} from "./place";
import { DOLL_HEIGHT } from "./rig";

describe("depth", () => {
  it("is 1 at the picture plane and grows toward the camera", () => {
    expect(depthScale(0)).toBe(1);
    expect(depthScale(500)).toBeCloseTo(2, 10);
    expect(depthScale(-1000)).toBeCloseTo(0.5, 10);
  });

  it("is held below the camera: nothing runs away", () => {
    const near = depthScale(CAMERA_DISTANCE * 0.9);
    expect(depthScale(CAMERA_DISTANCE)).toBe(near);
    expect(depthScale(CAMERA_DISTANCE * 5)).toBe(near);
    expect(Number.isFinite(near)).toBe(true);
  });
});

describe("rootScale", () => {
  it("makes the doll `height` pixels tall at z = 0", () => {
    expect(rootScale(340, 0) * DOLL_HEIGHT).toBeCloseTo(340, 10);
  });

  it("is smaller nearer the camera so the drawn height stays the asked height", () => {
    for (const z of [-400, 0, 300, 600]) {
      expect(rootScale(200, z) * DOLL_HEIGHT * depthScale(z)).toBeCloseTo(200, 8);
    }
  });

  it("under a parent that is already scaled, the product is the same", () => {
    const parent = 2.5;
    expect(fitScale(200, 0, parent) * parent).toBeCloseTo(rootScale(200, 0), 10);
    expect(fitScale(200, 0, 0)).toBe(rootScale(200, 0));
  });
});

describe("projectToStage", () => {
  it("scales x and y by the depth and says by how much", () => {
    const out = { x: 0, y: 0, s: 0 };
    projectToStage(out, 100, -50, 500);
    expect(out.s).toBeCloseTo(2, 10);
    expect(out.x).toBeCloseTo(200, 8);
    expect(out.y).toBeCloseTo(-100, 8);
  });
});

describe("hit shapes", () => {
  it("a nearer thing has the smaller depth", () => {
    expect(hitDepth(300)).toBeLessThan(hitDepth(0));
  });

  it("circle: the edge is in, beyond is out", () => {
    expect(insideCircle(0, 0, 10, 10, 0)).toBe(true);
    expect(insideCircle(0, 0, 10, 10.01, 0)).toBe(false);
  });

  it("capsule: both ends, the middle and the sides are in, past the ends is out", () => {
    // A vertical segment from (0, 0) to (0, 100), radius 10.
    expect(insideCapsule(0, 0, 0, 100, 10, 0, 0)).toBe(true);
    expect(insideCapsule(0, 0, 0, 100, 10, 0, 100)).toBe(true);
    expect(insideCapsule(0, 0, 0, 100, 10, 10, 50)).toBe(true);
    expect(insideCapsule(0, 0, 0, 100, 10, 10.5, 50)).toBe(false);
    expect(insideCapsule(0, 0, 0, 100, 10, 0, 109)).toBe(true);
    expect(insideCapsule(0, 0, 0, 100, 10, 0, 111)).toBe(false);
    expect(insideCapsule(0, 0, 0, 100, 10, 0, -11)).toBe(false);
  });

  it("a capsule with no length is a circle", () => {
    expect(insideCapsule(5, 5, 5, 5, 3, 7, 5)).toBe(true);
    expect(insideCapsule(5, 5, 5, 5, 3, 9, 5)).toBe(false);
  });
});

describe("clientToStage", () => {
  it("puts the middle of the screen at the origin with y up", () => {
    const out = { x: 0, y: 0 };
    clientToStage(out, 720, 450, 1440, 900);
    expect(out).toEqual({ x: 0, y: 0 });
    clientToStage(out, 0, 0, 1440, 900);
    expect(out).toEqual({ x: -720, y: 450 });
    clientToStage(out, 1440, 900, 1440, 900);
    expect(out).toEqual({ x: 720, y: -450 });
  });
});

describe("DOLL_SIZE", () => {
  it("is about 40 percent smaller than the height asked for", () => {
    expect(DOLL_SIZE).toBeGreaterThan(0.55);
    expect(DOLL_SIZE).toBeLessThan(0.65);
    expect(drawnHeight(500)).toBe(500 * DOLL_SIZE);
  });

  it("a placement of the drawn height is as tall on the screen as the section asked, times the size", () => {
    for (const z of [-300, 0, 240]) {
      expect(rootScale(drawnHeight(400), z) * DOLL_HEIGHT * depthScale(z)).toBeCloseTo(
        400 * DOLL_SIZE,
        8,
      );
    }
  });
});
