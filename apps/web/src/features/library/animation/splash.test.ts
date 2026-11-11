import { describe, expect, it } from "vitest";

import { ORDER } from "./characters";
import { framePoint, splashFor } from "./splash";

/** Where the face lands in a `box` when a picture of `aspect` is covered and held at `focus`. */
function faceIn(
  face: { x: number; y: number },
  aspect: number,
  box: { w: number; h: number },
  focus: { x: number; y: number },
) {
  const s = Math.max(box.w / aspect, box.h);
  const w = aspect * s;
  const h = s;
  const left = (box.w - w) * focus.x;
  const top = (box.h - h) * focus.y;
  return { x: (face.x * w + left) / box.w, y: (face.y * h + top) / box.h };
}

describe("framePoint", () => {
  it("centres the face across a phone held upright", () => {
    const face = { x: 0.62, y: 0.3 };
    const at = framePoint(face, 16 / 9);
    expect(faceIn(face, 16 / 9, { w: 390, h: 844 }, at).x).toBeCloseTo(0.5, 2);
  });

  it("keeps the face in the upper part of a phone on its side", () => {
    const face = { x: 0.5, y: 0.45 };
    const at = framePoint(face, 16 / 9);
    const y = faceIn(face, 16 / 9, { w: 844, h: 390 }, at).y;
    expect(y).toBeCloseTo(0.4, 2);
  });

  it("brings a low face as high as the picture allows", () => {
    const face = { x: 0.5, y: 0.6 };
    const at = framePoint(face, 16 / 9);
    expect(at.y).toBe(1);
    expect(faceIn(face, 16 / 9, { w: 844, h: 390 }, at).y).toBeLessThan(0.6);
  });

  it("never moves the picture off its frame", () => {
    expect(framePoint({ x: 0.02, y: 0.02 }, 16 / 9)).toEqual({ x: 0, y: 0 });
    expect(framePoint({ x: 0.99, y: 0.99 }, 16 / 9)).toEqual({ x: 1, y: 1 });
  });

  it("does not care across a picture narrower than every frame", () => {
    expect(framePoint({ x: 0.2, y: 0.5 }, 0.3).x).toBe(0.5);
  });
});

describe("splashFor", () => {
  it("gives every character a picture and a face in view at four screen sizes", () => {
    for (const slug of ORDER) {
      const { src, focus } = splashFor(slug);
      expect(src).toBe(`/img/library/animation/splash/${slug}.webp`);
      expect(focus.x).toBeGreaterThanOrEqual(0);
      expect(focus.x).toBeLessThanOrEqual(1);
      expect(focus.y).toBeGreaterThanOrEqual(0);
      expect(focus.y).toBeLessThanOrEqual(1);
    }
  });
});
