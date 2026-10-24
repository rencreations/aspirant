import { describe, expect, it } from "vitest";

import { faceOf, openingState, seg, strokeTimes } from "./opening-math";

const M = { vw: 1600, vh: 900, cardW: 360, cardH: 450 };

describe("openingState", () => {
  it("starts as the whole hero", () => {
    const s = openingState(0, M);
    expect(s.frameSx).toBe(1);
    expect(s.frameSy).toBe(1);
    expect(s.frameOpacity).toBe(1);
    expect(s.tone).toBe(0);
    expect(s.uiOpacity).toBe(1);
    expect(s.glActive).toBe(true);
    expect(s.signed).toBe(false);
  });

  it("closes the frame into the card, and the picture keeps its shape", () => {
    const s = openingState(0.34, M);
    expect(s.frameSx).toBeCloseTo(M.cardW / M.vw);
    expect(s.frameSy).toBeCloseTo(M.cardH / M.vh);
    // On screen, the picture is the frame scale times its own: the same on both axes.
    expect(s.frameSx * s.innerSx).toBeCloseTo(s.frameSy * s.innerSy);
    expect(s.tone).toBe(1);
  });

  it("hands the card over, then writes the signature, then shows the statement", () => {
    expect(openingState(0.4, M).glActive).toBe(false);
    expect(openingState(0.4, M).cardOpacity).toBe(1);
    expect(openingState(0.5, M).signed).toBe(true);
    expect(openingState(0.8, M).cardOpacity).toBe(0);
    expect(openingState(1, M).statement).toBe(1);
  });

  it("never goes backwards while the frame closes", () => {
    let last = 1;
    for (let p = 0; p <= 0.34; p += 0.01) {
      const sx = openingState(p, M).frameSx;
      expect(sx).toBeLessThanOrEqual(last + 1e-9);
      last = sx;
    }
  });
});

describe("seg", () => {
  it("clamps", () => {
    expect(seg(-1, 0, 1)).toBe(0);
    expect(seg(2, 0, 1)).toBe(1);
    expect(seg(0.5, 0, 1)).toBe(0.5);
  });
});

describe("strokeTimes", () => {
  it("draws the strokes one after the other, longer ones for longer", () => {
    const t = strokeTimes([100, 300], 4, 0);
    expect(t[0]).toEqual({ delay: 0, duration: 1 });
    expect(t[1]).toEqual({ delay: 1, duration: 3 });
  });
});

describe("faceOf", () => {
  it("is near the upper middle on a wide screen and lower on a phone", () => {
    const wide = faceOf(1600, 900);
    const phone = faceOf(390, 844);
    expect(wide.x).toBe(0.5);
    expect(wide.y).toBeGreaterThan(0.38);
    expect(wide.y).toBeLessThan(0.5);
    expect(phone.y).toBeGreaterThan(wide.y + 0.15);
    expect(phone.y).toBeLessThan(1);
  });
});
