import { describe, expect, it } from "vitest";

import { qFromEuler, type Q } from "../image-field/math";
import { WINDOW_ASPECT } from "./layout";
import { contentWindow, inQuad, planeQuad, pointerOnPlane } from "./hit";
import { makePlane, type PlanePose } from "./types";

const vp = { w: 1440, h: 900 };

function plane(over: Partial<PlanePose> & { q?: Q } = {}): PlanePose {
  return { ...makePlane(), ...over };
}

type Quad8 = [number, number, number, number, number, number, number, number];

describe("the pointer on a plane", () => {
  it("is the middle on the plane's centre, and the corners at one half", () => {
    const p = plane({ x: 100, y: -50, w: 400, h: 200 });
    const out: [number, number] = [0, 0];
    // Screen point of the centre: (720 + 100, 450 + 50).
    expect(pointerOnPlane(820, 500, p, 1000, vp, out)).toBe(true);
    expect(out[0]).toBeCloseTo(0, 6);
    expect(out[1]).toBeCloseTo(0, 6);
    expect(pointerOnPlane(820 + 200, 500 - 100, p, 1000, vp, out)).toBe(true);
    expect(out[0]).toBeCloseTo(0.5, 6);
    expect(out[1]).toBeCloseTo(0.5, 6);
  });

  it("finds each corner of a leaning plane at its own corner (the quad and the ray agree)", () => {
    const q = qFromEuler(-0.9, 0.3, -0.2, [0, 0, 0, 1]);
    const p = plane({ x: 30, y: 20, z: 60, q, w: 500, h: 280 });
    const quad: Quad8 = [0, 0, 0, 0, 0, 0, 0, 0];
    expect(planeQuad(p, 2000, vp, quad)).toBe(true);
    const out: [number, number] = [0, 0];
    // Corners run top left, top right, bottom right, bottom left.
    const want: Array<[number, number]> = [
      [-0.5, 0.5],
      [0.5, 0.5],
      [0.5, -0.5],
      [-0.5, -0.5],
    ];
    for (let c = 0; c < 4; c++) {
      expect(pointerOnPlane(quad[c * 2]!, quad[c * 2 + 1]!, p, 2000, vp, out)).toBe(true);
      expect(out[0]).toBeCloseTo(want[c]![0], 5);
      expect(out[1]).toBeCloseTo(want[c]![1], 5);
    }
    // And a point inside the quad is inside it.
    expect(inQuad(quad, 720 + 30, 450 - 20)).toBe(true);
    expect(inQuad(quad, 5, 5)).toBe(false);
  });

  it("misses a plane that is edge on", () => {
    const q = qFromEuler(0, Math.PI / 2, 0, [0, 0, 0, 1]);
    const out: [number, number] = [0, 0];
    expect(pointerOnPlane(900, 500, plane({ q }), 1000, vp, out)).toBe(false);
  });
});

describe("the window of the picture a plane shows", () => {
  const pic = 1920 / 808;
  const out: [number, number, number, number] = [0, 0, 0, 0];

  it("shows the cover of a 16 to 9 frame when the plane is 16 to 9", () => {
    contentWindow(WINDOW_ASPECT, WINDOW_ASPECT, pic, 0.5, 0.5, 1, 0, 0, out);
    expect(out[2]).toBeCloseTo(WINDOW_ASPECT / pic, 6);
    expect(out[3]).toBeCloseTo(1, 6);
    expect(out[0]).toBeCloseTo(0.5, 6);
  });

  it("shows a band of it, not a refit, when the plane is wider: the picture keeps its width and scale", () => {
    const full: [number, number, number, number] = [0, 0, 0, 0];
    contentWindow(WINDOW_ASPECT, WINDOW_ASPECT, pic, 0.5, 0.5, 1, 0, 0, full);
    contentWindow(3.7, WINDOW_ASPECT, pic, 0.5, 0.5, 1, 0, 0, out);
    expect(out[2]).toBeCloseTo(full[2], 9);
    expect(out[3]).toBeCloseTo((full[3] * WINDOW_ASPECT) / 3.7, 9);
  });

  it("never distorts: a pixel of the picture is as wide as it is tall, whatever the frame's opening", () => {
    // The frame is `w` by `h` px; the window is `out[2]` by `out[3]` of the picture (1920 by 808 px).
    const sceneW = 1120;
    for (let e = 0; e <= 1.0001; e += 0.125) {
      const s = 0.45 + 0.55 * e;
      const inset = 0.2597 * (1 - e);
      const w = s * sceneW;
      const h = ((s * sceneW) / WINDOW_ASPECT) * (1 - 2 * inset);
      contentWindow(w / h, WINDOW_ASPECT, pic, 0.5, 0.5, 1, 0, 0, out);
      const pxPerPicX = w / (out[2] * 1920);
      const pxPerPicY = h / (out[3] * 808);
      expect(pxPerPicX / pxPerPicY).toBeCloseTo(1, 9);
      // And the picture's scale is the frame's scale: it only changes with the opening's scale.
      expect(pxPerPicX).toBeCloseTo((s * sceneW) / ((WINDOW_ASPECT / pic) * 1920), 9);
    }
  });

  it("shows less of its width when the plane is taller than the frame", () => {
    contentWindow(1.2, WINDOW_ASPECT, pic, 0.5, 0.5, 1, 0, 0, out);
    expect(out[3]).toBeCloseTo(1, 9);
    expect(out[2]).toBeCloseTo((WINDOW_ASPECT / pic) * (1.2 / WINDOW_ASPECT), 9);
  });

  it("keeps the window inside the picture when it is shifted or zoomed", () => {
    contentWindow(WINDOW_ASPECT, WINDOW_ASPECT, pic, 0.5, 0.5, 1.1, 9, -9, out);
    expect(out[0] - out[2] / 2).toBeGreaterThanOrEqual(-1e-9);
    expect(out[0] + out[2] / 2).toBeLessThanOrEqual(1 + 1e-9);
    expect(out[1] - out[3] / 2).toBeGreaterThanOrEqual(-1e-9);
    expect(out[1] + out[3] / 2).toBeLessThanOrEqual(1 + 1e-9);
    // A zoom below 1 is held at 1.
    contentWindow(WINDOW_ASPECT, WINDOW_ASPECT, pic, 0.5, 0.5, 0.2, 0, 0, out);
    expect(out[2]).toBeCloseTo(WINDOW_ASPECT / pic, 6);
  });

  it("shows a preview's clip whole", () => {
    contentWindow(560 / 286, 560 / 286, 560 / 286, 0.5, 0.5, 1, 0, 0, out);
    expect(out).toEqual([0.5, 0.5, 1, 1]);
  });
});
