import { describe, expect, it } from "vitest";

import {
  clamp01,
  clientToStage,
  easeInQuad,
  easeOutBack,
  envelopeAt,
  hash01,
  hashRange,
  hashSigned,
  ndcToPixels,
  type Envelope,
} from "./math";

const env = (): Envelope => ({ scale: 1, squash: 0, alpha: 1 });
const params = { popT: 0.2, fadeT: 0.3, overshoot: 1.7, squash: 0.2, held: false };

describe("hash", () => {
  it("is the same for the same seed and index", () => {
    expect(hash01(12, 3)).toBe(hash01(12, 3));
    expect(hash01(12, 3)).not.toBe(hash01(12, 4));
    expect(hash01(12, 3)).not.toBe(hash01(13, 3));
  });

  it("stays in range and is spread out", () => {
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const v = hash01(i * 7 + 1, i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 2000).toBeGreaterThan(0.45);
    expect(sum / 2000).toBeLessThan(0.55);
  });

  it("maps to a range and to a signed range", () => {
    for (let i = 0; i < 200; i++) {
      const r = hashRange(5, i, 10, 20);
      expect(r).toBeGreaterThanOrEqual(10);
      expect(r).toBeLessThan(20);
      const s = hashSigned(5, i);
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThan(1);
    }
  });
});

describe("easing", () => {
  it("clamps", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });

  it("ease out back starts at 0, ends at 1 and overshoots on the way", () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, easeOutBack(i / 100));
    expect(peak).toBeGreaterThan(1.05);
    expect(easeOutBack(0.6, 0)).toBeLessThanOrEqual(1);
  });

  it("ease in quad", () => {
    expect(easeInQuad(0)).toBe(0);
    expect(easeInQuad(1)).toBe(1);
    expect(easeInQuad(0.5)).toBe(0.25);
  });
});

describe("envelope", () => {
  it("is invisible before the mark is born", () => {
    const e = env();
    envelopeAt(-0.1, 1, params, e);
    expect(e.alpha).toBe(0);
  });

  it("pops to full size, then holds, then fades to nothing at the end of its life", () => {
    const e = env();
    envelopeAt(0, 1, params, e);
    expect(e.scale).toBeCloseTo(0, 5);
    envelopeAt(0.5, 1, params, e);
    expect(e.scale).toBe(1);
    expect(e.alpha).toBe(1);
    expect(e.squash).toBe(0);
    envelopeAt(1, 1, params, e);
    expect(e.alpha).toBeCloseTo(0, 6);
    expect(e.scale).toBeLessThan(1);
  });

  it("squashes during the pop and settles to nothing", () => {
    const e = env();
    let max = 0;
    for (let i = 1; i < 20; i++) {
      envelopeAt((i / 20) * params.popT, 1, params, e);
      max = Math.max(max, Math.abs(e.squash));
    }
    expect(max).toBeGreaterThan(0.01);
    envelopeAt(params.popT + 0.01, 1, params, e);
    expect(e.squash).toBe(0);
  });

  it("a held mark never fades", () => {
    const e = env();
    envelopeAt(50, 1, { ...params, held: true }, e);
    expect(e.alpha).toBe(1);
  });
});

describe("frames", () => {
  it("client pixels to the stage frame (middle origin, y up)", () => {
    const out = { x: 0, y: 0 };
    clientToStage(0, 0, 800, 600, out);
    expect(out).toEqual({ x: -400, y: 300 });
    clientToStage(800, 600, 800, 600, out);
    expect(out).toEqual({ x: 400, y: -300 });
    clientToStage(400, 300, 800, 600, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it("normalised device coordinates to the stage frame", () => {
    const out = { x: 0, y: 0 };
    ndcToPixels(1, 1, 800, 600, out);
    expect(out).toEqual({ x: 400, y: 300 });
    ndcToPixels(-1, -1, 800, 600, out);
    expect(out).toEqual({ x: -400, y: -300 });
  });
});
