import { describe, expect, it } from "vitest";

import {
  BUFFER_BUDGET,
  approachK,
  approachParams,
  bufferScaleFor,
  bufferSize,
  copyParams,
  makeParams,
  writeNumbers,
  writePalette,
} from "./params";

describe("approach", () => {
  it("is the same after a second at 60 and at 144 frames a second", () => {
    const run = (hz: number) => {
      const cur = makeParams();
      const tgt = makeParams();
      cur.amount = 0;
      tgt.amount = 1;
      for (let i = 0; i < hz; i++) approachParams(cur, tgt, approachK(1 / hz, 7));
      return cur.amount;
    };
    expect(run(60)).toBeCloseTo(run(144), 3);
    expect(run(60)).toBeGreaterThan(0.99);
  });

  it("does not move when time stands still", () => {
    expect(approachK(0, 7)).toBe(0);
    expect(approachK(-1, 7)).toBe(0);
  });

  it("moves the colours too, and takes the seed at once", () => {
    const cur = makeParams();
    const tgt = makeParams();
    tgt.stops.fill(1);
    tgt.seed = 9;
    approachParams(cur, tgt, 0.5);
    expect(cur.stops[0]).toBeCloseTo(0.5);
    expect(cur.seed).toBe(9);
  });

  it("copies everything", () => {
    const a = makeParams();
    const b = makeParams();
    b.amount = 0.3;
    b.stops[5] = 0.7;
    b.ink[1] = 0.2;
    copyParams(a, b);
    expect(a.amount).toBe(0.3);
    expect(a.stops[5]).toBeCloseTo(0.7);
    expect(a.ink[1]).toBeCloseTo(0.2);
  });
});

describe("writePalette", () => {
  const palette = { colors: ["#ff0000", "#00ff00"], intensity: 1, ink: "#0000ff" };

  it("writes the palette's four stops and ink", () => {
    const p = makeParams();
    writePalette(p, palette, undefined, undefined);
    expect([...p.stops.slice(0, 3)]).toEqual([1, 0, 0]);
    expect([...p.stops.slice(3, 6)]).toEqual([0, 1, 0]);
    expect([...p.stops.slice(6, 9)]).toEqual([1, 0, 0]);
    expect([...p.ink]).toEqual([0, 0, 1]);
  });

  it("takes the colours a section gives, and falls back to the palette when they do not parse", () => {
    const p = makeParams();
    writePalette(p, palette, ["#000000"], undefined);
    expect([...p.stops.slice(0, 3)]).toEqual([0, 0, 0]);
    writePalette(p, palette, ["nope"], "also nope");
    expect([...p.stops.slice(0, 3)]).toEqual([1, 0, 0]);
    expect([...p.ink]).toEqual([0, 0, 1]);
  });
});

describe("writeNumbers", () => {
  const defaults = { speed: 1.5, scale: 1, angle: 10 };

  it("uses the kind's defaults and the palette's intensity", () => {
    const p = makeParams();
    writeNumbers(p, defaults, 0.8, {});
    expect(p.amount).toBe(1);
    expect(p.speed).toBe(1.5);
    expect(p.intensity).toBeCloseTo(0.8);
    expect(p.angle).toBeCloseTo((10 * Math.PI) / 180);
  });

  it("clamps the amount to 0..1 and keeps speed and scale sane", () => {
    const p = makeParams();
    writeNumbers(p, defaults, 1, { amount: 4, speed: -2, scale: 0 });
    expect(p.amount).toBe(1);
    expect(p.speed).toBe(0);
    expect(p.scale).toBeGreaterThan(0);
    writeNumbers(p, defaults, 1, { amount: -1 });
    expect(p.amount).toBe(0);
  });

  it("turns degrees into radians and multiplies the intensity", () => {
    const p = makeParams();
    writeNumbers(p, defaults, 0.5, { angle: 90, intensity: 2 });
    expect(p.angle).toBeCloseTo(Math.PI / 2);
    expect(p.intensity).toBeCloseTo(1);
  });
});

describe("the drawing buffer", () => {
  it("is the kind's fraction of the canvas, but never more than the display has", () => {
    expect(bufferScaleFor(0.5, 2)).toBe(0.5);
    expect(bufferScaleFor(1.5, 1)).toBe(1);
    expect(bufferScaleFor(1.5, 2)).toBe(1.5);
    expect(bufferScaleFor(0.5, 0)).toBe(0.5);
  });

  it("is half the canvas for a soft kind", () => {
    expect(bufferSize(1440, 900, 0.5)).toEqual({ w: 720, h: 450 });
  });

  it("stays inside the pixel budget on a huge canvas", () => {
    const s = bufferSize(3840, 2160, 1.5);
    expect(s.w * s.h).toBeLessThanOrEqual(BUFFER_BUDGET * 1.01);
    expect(s.w / s.h).toBeCloseTo(3840 / 2160, 1);
  });

  it("is at least a few pixels, whatever the canvas", () => {
    const s = bufferSize(0, 0, 0.25);
    expect(s.w).toBeGreaterThanOrEqual(2);
    expect(s.h).toBeGreaterThanOrEqual(2);
  });
});
