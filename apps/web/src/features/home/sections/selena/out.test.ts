import { describe, expect, it } from "vitest";

import { AT, CLIP_KEYS, T_EXT, ZOOM, clipTime, newOut, outAt, zoomRect } from "./out";

const STEPS = 400;

describe("the out animation's beats", () => {
  it("starts on the room: the clip at 0, nothing zoomed, no sheet, the pair docked", () => {
    const b = outAt(0);
    expect(b.t).toBe(0);
    expect(b.zoom).toBe(0);
    expect(b.arm).toBe(0);
    expect(b.sheet).toBe(false);
    expect(b.pair).toBe(0);
    expect(b.white).toBe(0);
    expect(b.room).toBe(1);
    expect(b.actors).toBe(true);
  });

  it("ends on a white screen with the hand gone", () => {
    const b = outAt(1);
    expect(b.white).toBe(1);
    expect(b.pair).toBe(1);
    expect(b.actors).toBe(false);
    expect(b.room).toBe(0);
  });

  it("plays the clip forward to the pose with the hand out, then holds it", () => {
    let last = -1;
    for (let i = 0; i <= STEPS; i += 1) {
      const t = outAt(i / STEPS).t;
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    expect(clipTime(CLIP_KEYS[CLIP_KEYS.length - 1]![0])).toBeCloseTo(T_EXT, 6);
    expect(outAt(0.6).t).toBe(T_EXT);
    expect(outAt(0.99).t).toBe(T_EXT);
  });

  it("is continuous: no beat jumps between two close steps", () => {
    let last = outAt(0);
    const keys: Array<keyof ReturnType<typeof newOut>> = [
      "zoom",
      "handX",
      "handY",
      "depth",
      "close",
      "hang",
      "grip",
      "pan",
      "fold",
      "pair",
      "white",
      "room",
    ];
    for (let i = 1; i <= STEPS; i += 1) {
      const b = outAt(i / STEPS);
      for (const k of keys) {
        expect(Math.abs((b[k] as number) - (last[k] as number))).toBeLessThan(0.1);
      }
      last = { ...b };
    }
  });

  it("takes the hand from the top of its reach to below the picture, with the pan", () => {
    const top = outAt(AT.pull[0]);
    const end = outAt(AT.pull[1]);
    expect(top.handY).toBeGreaterThan(0.3);
    // The hand's own picture and the pan together put it below the bottom edge (y -1) and past its size.
    expect(end.handY - end.pan).toBeLessThan(-1.4);
  });

  it("covers the screen before the white takes it over, and the pair are gone before the camera moves", () => {
    const b = outAt(AT.white[0]);
    expect(b.handY - b.pan).toBeLessThan(-1.4);
    expect(outAt(AT.pair[1]).pair).toBe(1);
    expect(AT.pair[1]).toBeLessThanOrEqual(0.05);
  });

  it("goes back the way it came: the same progress gives the same beats", () => {
    const a = outAt(0.73);
    outAt(0.2);
    const c = outAt(0.73);
    expect({ ...a }).toEqual({ ...c });
  });
});

describe("zoomRect", () => {
  const view = {
    fullWidth: 1440,
    fullHeight: 1125,
    offsetX: 0,
    offsetY: 225,
    width: 1440,
    height: 900,
  };
  const out = { ...view };

  it("keeps the picture when the zoom is 1 and the point stays", () => {
    zoomRect(view, 1, 0.3, -0.2, 0.3, -0.2, out);
    expect(out.width).toBeCloseTo(1440, 6);
    expect(out.offsetX).toBeCloseTo(0, 6);
    expect(out.offsetY).toBeCloseTo(225, 6);
  });

  it("puts the chosen point at the chosen place of the zoomed picture", () => {
    zoomRect(view, ZOOM, 0.42, -0.3, 0.1, 0.2, out);
    expect(out.width).toBeCloseTo(1440 / ZOOM, 6);
    // The point's pixel in the full frame, then in the window.
    const px = view.offsetX + (0.42 * 0.5 + 0.5) * view.width;
    const py = view.offsetY + (0.5 + 0.3 * 0.5) * view.height;
    const qx = (px - out.offsetX) / out.width;
    const qy = (py - out.offsetY) / out.height;
    expect(qx).toBeCloseTo(0.1 * 0.5 + 0.5, 6);
    expect(qy).toBeCloseTo(0.5 - 0.2 * 0.5, 6);
  });
});
