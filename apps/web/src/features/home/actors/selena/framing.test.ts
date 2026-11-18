import { describe, expect, it } from "vitest";

import { frameFor, inside, worldPoint, worldScale } from "./framing";

describe("worldScale", () => {
  it("is the pixels per metre at z = 0", () => {
    expect(worldScale(900, 1.8, 0, 1000)).toBeCloseTo(500, 6);
  });

  it("shrinks the world scale for a figure nearer the camera so the screen height holds", () => {
    // At z = 500 the figure is half as far, so the world scale halves for the same screen height.
    expect(worldScale(900, 1.8, 500, 1000)).toBeCloseTo(250, 6);
    // Projected size: scale * metres * distance / (distance - z) is the height again.
    const s = worldScale(900, 1.8, 500, 1000);
    expect((s * 1.8 * 1000) / (1000 - 500)).toBeCloseTo(900, 6);
  });

  it("never divides by zero at the camera", () => {
    expect(Number.isFinite(worldScale(900, 1.8, 1000, 1000))).toBe(true);
    expect(Number.isFinite(worldScale(900, 1.8, 3000, 1000))).toBe(true);
  });
});

describe("worldPoint", () => {
  it("projects back to the screen point", () => {
    const [X, Y, Z] = worldPoint(200, -100, 400, 1000);
    const k = 1000 / (1000 - Z);
    expect(X * k).toBeCloseTo(200, 6);
    expect(Y * k).toBeCloseTo(-100, 6);
  });
});

describe("frameFor", () => {
  const view = { w: 1440, h: 900 };
  const anchor = { x: -0.2, y: 0.8 };

  it("centres the pose's box in the rectangle and fits its height", () => {
    // A box one metre wide and two tall whose middle is the anchor, in a 4:5 rectangle.
    const fit = { cx: -0.2, cy: 0.8, w: 1, h: 2 };
    const f = frameFor({ x: 432, y: 90, w: 576, h: 720 }, view, fit, anchor, 1.85);
    expect(f.x).toBeCloseTo(0, 6);
    expect(f.y).toBeCloseTo(0, 6);
    // 720 * 0.94 px for two metres: the reference of 1.85 metres is that much smaller.
    expect(f.height).toBeCloseTo(((720 * 0.94) / 2) * 1.85, 6);
  });

  it("fits the width when the rectangle is narrow", () => {
    const fit = { cx: -0.2, cy: 0.8, w: 2, h: 1 };
    const f = frameFor({ x: 0, y: 0, w: 200, h: 900 }, view, fit, anchor, 1);
    expect(f.height).toBeCloseTo((200 * 0.94) / 2, 6);
    expect(f.x).toBeCloseTo(100 - 720, 6);
  });

  it("moves her so the box, not the anchor, lands in the middle", () => {
    // The box is a metre to the right of and half a metre above the anchor.
    const fit = { cx: 0.8, cy: 1.3, w: 1, h: 1 };
    const f = frameFor({ x: 0, y: 0, w: 1440, h: 900 }, view, fit, anchor, 1);
    const pxPerMetre = f.height;
    // The anchor sits left of and below the middle by those distances.
    expect(f.x).toBeCloseTo(-1 * pxPerMetre, 6);
    expect(f.y).toBeCloseTo(-0.5 * pxPerMetre, 6);
  });
});

describe("inside", () => {
  it("is always true with no rectangle", () => {
    expect(inside(null, -5, 9999)).toBe(true);
  });
  it("tests the edges", () => {
    const r = { x: 10, y: 20, w: 100, h: 50 };
    expect(inside(r, 10, 20)).toBe(true);
    expect(inside(r, 110, 70)).toBe(true);
    expect(inside(r, 111, 70)).toBe(false);
    expect(inside(r, 50, 19)).toBe(false);
  });
});
