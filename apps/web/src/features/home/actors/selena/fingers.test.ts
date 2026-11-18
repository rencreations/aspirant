import { describe, expect, it } from "vitest";

import {
  FINGERS,
  FIST,
  FingerBank,
  MAX_JOINT,
  breath,
  flexAxis,
  jointAngle,
  pointerCurl,
  waveCurl,
} from "./fingers";

const TIPS = [0, 0, 30, 0, 60, 0, 90, 0, 120, 0];

describe("jointAngle", () => {
  it("is the notes' mapping at weight 1: knuckle 0.18, middle 0.28, tip 0.20 for the middle finger", () => {
    expect(jointAngle("middle", 0, 1)).toBeCloseTo(0.18, 6);
    expect(jointAngle("middle", 1, 1)).toBeCloseTo(0.28, 6);
    expect(jointAngle("middle", 2, 1)).toBeCloseTo(0.2, 6);
  });

  it("the pinky bends more than the index, as in the notes", () => {
    expect(jointAngle("pinky", 1, 1)).toBeGreaterThan(jointAngle("index", 1, 1));
  });

  it("a fist is a deep bend and never passes the limit", () => {
    const total = [0, 1, 2].reduce((a, j) => a + jointAngle("ring", j as 0 | 1 | 2, FIST), 0);
    expect(total).toBeGreaterThan(1.8);
    for (const f of FINGERS) {
      for (const j of [0, 1, 2] as const) {
        expect(jointAngle(f, j, 50)).toBeLessThanOrEqual(MAX_JOINT);
      }
    }
  });

  it("a finger may reach back a little, and no further", () => {
    expect(jointAngle("index", 1, -0.1)).toBeLessThan(0);
    expect(jointAngle("index", 1, -9)).toBeGreaterThan(-0.1);
  });
});

describe("flexAxis", () => {
  it("is the notes' axes: z for four fingers, y for the thumb with the sign of the side", () => {
    expect(flexAxis("L", "index")).toEqual([0, 0, 1]);
    expect(flexAxis("R", "pinky")).toEqual([0, 0, 1]);
    expect(flexAxis("L", "thumb")).toEqual([0, 1, 0]);
    expect(flexAxis("R", "thumb")).toEqual([0, -1, 0]);
  });
});

describe("pointerCurl", () => {
  const input = (px: number, py: number, live = true) => ({
    px,
    py,
    tips: TIPS,
    palmX: 60,
    palmY: 40,
    radius: 40,
    live,
  });

  it("bends the finger the pointer is on and less the others", () => {
    const out = new Float32Array(5);
    pointerCurl(input(60, 0), out, 0);
    expect(out[2]).toBeGreaterThan(0.7);
    expect(out[0]).toBeLessThan(out[2]!);
    expect(out[4]).toBeLessThan(out[2]!);
  });

  it("does nothing when the pointer is far from the hand or not on the page", () => {
    const out = new Float32Array(5);
    pointerCurl(input(900, 700), out, 0);
    expect(Math.max(...out)).toBeLessThan(0.01);
    pointerCurl(input(60, 0, false), out, 0);
    expect(Math.max(...out)).toBe(0);
  });
});

describe("waveCurl and breath", () => {
  it("the wave is nothing without a reaction and runs between 0 and 1 with one", () => {
    expect(waveCurl(2, 1, 0)).toBe(0);
    let max = 0;
    let min = 1;
    for (let t = 0; t < 2; t += 0.01) {
      const w = waveCurl(2, t, 1);
      max = Math.max(max, w);
      min = Math.min(min, w);
    }
    expect(max).toBeGreaterThan(0.7);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("the breath is small and moves", () => {
    let max = 0;
    let min = 0;
    for (let t = 0; t < 20; t += 0.1) {
      const b = breath("L", 1, 1, t);
      max = Math.max(max, b);
      min = Math.min(min, b);
    }
    expect(max).toBeLessThanOrEqual(0.025 + 1e-9);
    expect(max - min).toBeGreaterThan(0.02);
  });
});

describe("FingerBank", () => {
  it("follows a target with a little overshoot and settles, and holds on a step of zero", () => {
    const bank = new FingerBank();
    let peak = 0;
    for (let i = 0; i < 60; i += 1) peak = Math.max(peak, bank.step(0, 2, 1, 1 / 60));
    expect(peak).toBeGreaterThan(1);
    for (let i = 0; i < 240; i += 1) bank.step(0, 2, 1, 1 / 60);
    expect(bank.value(0, 2)).toBeCloseTo(1, 2);
    const v = bank.value(0, 2);
    bank.step(0, 2, 0, 0);
    expect(bank.value(0, 2)).toBe(v);
    expect(bank.value(1, 2)).toBe(0);
  });

  it("snap puts every finger at rest", () => {
    const bank = new FingerBank();
    bank.step(1, 4, 1, 0.3);
    bank.snap();
    expect(bank.value(1, 4)).toBe(0);
  });
});
