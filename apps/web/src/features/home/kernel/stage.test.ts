import { Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  MAX_DPR,
  PIXEL_BUDGET,
  PIXEL_DISTANCE,
  ScenePass,
  makePixelOrthoCamera,
  makePixelPerspectiveCamera,
  pixelFov,
  pixelRatioFor,
} from "./stage";

describe("pixelRatioFor", () => {
  it("is the display's ratio on an ordinary screen", () => {
    expect(pixelRatioFor(1440, 900, 1)).toBe(1);
    expect(pixelRatioFor(1440, 900, 1.5)).toBe(1.5);
  });

  it("never goes above 2", () => {
    expect(pixelRatioFor(800, 600, 3)).toBe(MAX_DPR);
  });

  it("keeps the canvas under the pixel budget on a big screen", () => {
    const r = pixelRatioFor(3840, 2160, 2);
    expect(r).toBeLessThan(2);
    expect(3840 * r * (2160 * r)).toBeLessThanOrEqual(PIXEL_BUDGET + 1);
  });

  it("falls back to 1 for a display that does not say", () => {
    expect(pixelRatioFor(1000, 1000, 0)).toBe(1);
  });
});

describe("the pixel cameras", () => {
  it("pixelFov matches the height at the distance", () => {
    expect(pixelFov(900, 1000)).toBeCloseTo((2 * Math.atan(0.45) * 180) / Math.PI, 9);
  });

  it("maps one orthographic unit to one pixel, y up, the origin in the middle", () => {
    const cam = makePixelOrthoCamera(1440, 900);
    cam.updateMatrixWorld();
    const ndc = (x: number, y: number) => new Vector3(x, y, 0).project(cam);
    expect(ndc(0, 0).x).toBeCloseTo(0);
    expect(ndc(720, 0).x).toBeCloseTo(1);
    expect(ndc(-720, 0).x).toBeCloseTo(-1);
    expect(ndc(0, 450).y).toBeCloseTo(1);
    expect(ndc(0, -450).y).toBeCloseTo(-1);
    expect(ndc(144, -90).x).toBeCloseTo(0.2);
    expect(ndc(144, -90).y).toBeCloseTo(-0.2);
  });

  it("matches pixels at z = 0 with the perspective camera, for several screens", () => {
    for (const [w, h] of [
      [1440, 900],
      [1706, 950],
      [390, 844],
    ] as const) {
      const cam = makePixelPerspectiveCamera(w, h);
      cam.updateMatrixWorld();
      for (const [x, y] of [
        [0, 0],
        [w / 2, h / 2],
        [-w / 4, h / 3],
        [w / 5, -h / 2.5],
      ] as const) {
        const p = new Vector3(x, y, 0).project(cam);
        expect(p.x, `${w}x${h} x`).toBeCloseTo(x / (w / 2), 6);
        expect(p.y, `${w}x${h} y`).toBeCloseTo(y / (h / 2), 6);
      }
    }
  });

  it("makes things nearer than z = 0 bigger and farther ones smaller", () => {
    const cam = makePixelPerspectiveCamera(1440, 900);
    cam.updateMatrixWorld();
    const at = (z: number) => new Vector3(100, 0, z).project(cam).x;
    expect(at(200)).toBeGreaterThan(at(0));
    expect(at(-200)).toBeLessThan(at(0));
  });

  it("uses the default distance when none is given", () => {
    expect(makePixelPerspectiveCamera(1000, 500).position.z).toBe(PIXEL_DISTANCE);
  });
});

describe("ScenePass", () => {
  it("is active only while something in its scene is visible", () => {
    const pass = new ScenePass("p", 10, "ortho", 800, 600);
    expect(pass.active()).toBe(false);
    const child = new Object3D();
    pass.scene.add(child);
    expect(pass.active()).toBe(true);
    child.visible = false;
    expect(pass.active()).toBe(false);
  });

  it("keeps its camera matched to the screen when it is resized", () => {
    const ortho = new ScenePass("o", 10, "ortho", 800, 600);
    ortho.resize(1000, 500);
    const o = ortho.camera;
    o.updateMatrixWorld();
    expect(new Vector3(500, 250, 0).project(o).x).toBeCloseTo(1);
    expect(new Vector3(500, 250, 0).project(o).y).toBeCloseTo(1);

    const persp = new ScenePass("p", 20, "perspective", 800, 600);
    persp.resize(390, 844);
    const p = persp.camera;
    p.updateMatrixWorld();
    expect(new Vector3(195, 422, 0).project(p).x).toBeCloseTo(1, 6);
    expect(new Vector3(195, 422, 0).project(p).y).toBeCloseTo(1, 6);
  });
});
