import { describe, expect, it } from "vitest";

import {
  bufferRatio,
  easeLook,
  easeWash,
  mixAngle,
  mixLook,
  SEAS,
  slatScale,
  type SlatsLook,
} from "./look";

const A: SlatsLook = {
  color: "#000000",
  glint: "#ff0000",
  ground: "#102030",
  sea: SEAS.swell,
  slatWidth: 10,
  slatHeight: 20,
  gap: 2,
  roundness: 0,
};
const B: SlatsLook = {
  color: "#ffffff",
  glint: "#0000ff",
  ground: "#302010",
  sea: SEAS.storm,
  slatWidth: 20,
  slatHeight: 40,
  gap: 4,
  roundness: 1,
};

describe("mixLook", () => {
  it("gives the first look at 0 and the second at 1", () => {
    expect(mixLook(A, B, 0)).toEqual({ ...A, sea: { ...A.sea } });
    expect(mixLook(A, B, 1)).toEqual({ ...B, sea: { ...B.sea } });
  });

  it("blends colours, sizes and the sea half way", () => {
    const m = mixLook(A, B, 0.5);
    expect(m.color).toBe("#808080");
    expect(m.ground).toBe("#202020");
    expect(m.slatWidth).toBe(15);
    expect(m.roundness).toBe(0.5);
    expect(m.sea.speed).toBeCloseTo((SEAS.swell.speed + SEAS.storm.speed) / 2);
  });

  it("clamps the amount", () => {
    expect(mixLook(A, B, 2).slatWidth).toBe(20);
    expect(mixLook(A, B, -1).slatWidth).toBe(10);
  });
});

describe("mixAngle", () => {
  it("turns the short way round", () => {
    expect(mixAngle(350, 10, 0.5)).toBeCloseTo(0);
    expect(mixAngle(10, 350, 0.5)).toBeCloseTo(0);
    expect(mixAngle(180, 270, 0.5)).toBeCloseTo(225);
  });
});

describe("eases", () => {
  it("start at 0, end at 1 and never go back", () => {
    for (const ease of [easeLook, easeWash]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      let last = 0;
      for (let t = 0; t <= 1; t += 0.05) {
        expect(ease(t)).toBeGreaterThanOrEqual(last);
        last = ease(t);
      }
    }
  });

  it("move the front of a new look at once, ahead of the rest", () => {
    expect(easeWash(0.15)).toBeGreaterThan(0.35);
    expect(easeWash(0.15)).toBeGreaterThan(easeLook(0.15));
  });
});

describe("slatScale", () => {
  it("is 1 on a screen whose short side is 900", () => {
    expect(slatScale({ w: 1440, h: 900 })).toBe(1);
  });

  it("makes the slats smaller on a phone, held either way, and larger on a big screen", () => {
    expect(slatScale({ w: 390, h: 844 })).toBeCloseTo(0.62);
    expect(slatScale({ w: 844, h: 390 })).toBeCloseTo(0.62);
    expect(slatScale({ w: 2560, h: 1440 })).toBeGreaterThan(1);
    expect(slatScale({ w: 7680, h: 4320 })).toBe(1.3);
  });
});

describe("bufferRatio", () => {
  it("keeps the screen's ratio while the budget allows, never above 2", () => {
    expect(bufferRatio({ w: 390, h: 844 }, 3, 3.6e6)).toBe(2);
    expect(bufferRatio({ w: 1440, h: 900 }, 1, 3.6e6)).toBe(1);
  });

  it("lowers it to stay under the pixel budget", () => {
    const r = bufferRatio({ w: 2560, h: 1440 }, 2, 3.6e6);
    expect(2560 * 1440 * r * r).toBeLessThanOrEqual(3.6e6 + 1);
  });
});
