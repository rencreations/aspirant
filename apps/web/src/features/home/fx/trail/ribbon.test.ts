import { describe, expect, it } from "vitest";

import { TrailHistory } from "./ring";
import {
  CAP_PAIRS,
  VERTEX_FLOATS,
  gradientAt,
  ribbonAlpha,
  ribbonWidth,
  writeRibbon,
  type RibbonStyle,
} from "./ribbon";

const style: RibbonStyle = {
  width: 20,
  taper: 1,
  fade: 1,
  alpha: 1,
  life: 1,
  stops: new Float32Array([1, 0, 0, 0, 0, 1]),
};
const PAIRS = 50;

function ribbon(
  head: { x: number; y: number } | null,
  points: Array<[number, number, number]>,
  now = 1,
  s: RibbonStyle = style,
): { out: Float32Array; n: number } {
  const h = new TrailHistory(40);
  for (const [x, y, t] of points) h.push(x, y, t);
  const out = new Float32Array(PAIRS * 2 * VERTEX_FLOATS).fill(NaN);
  const n = writeRibbon(out, 0, PAIRS, head, h, now, s);
  return { out, n };
}

const allFinite = (out: Float32Array): boolean => out.every((v) => Number.isFinite(v));
const pair = (out: Float32Array, k: number): { l: number[]; r: number[] } => ({
  l: Array.from(out.slice(k * 2 * VERTEX_FLOATS, k * 2 * VERTEX_FLOATS + VERTEX_FLOATS)),
  r: Array.from(out.slice(k * 2 * VERTEX_FLOATS + VERTEX_FLOATS, (k + 1) * 2 * VERTEX_FLOATS)),
});
const widthOf = (out: Float32Array, k: number): number => {
  const { l, r } = pair(out, k);
  return Math.hypot(l[0]! - r[0]!, l[1]! - r[1]!);
};

describe("profiles", () => {
  it("the width tapers from full to nothing", () => {
    expect(ribbonWidth(0, 20, 1)).toBe(20);
    expect(ribbonWidth(1, 20, 1)).toBe(0);
    expect(ribbonWidth(0.5, 20, 1)).toBe(10);
    expect(ribbonWidth(2, 20, 1)).toBe(0);
    expect(ribbonWidth(0.5, 20, 2)).toBeCloseTo(5, 6);
    expect(ribbonWidth(0.5, 20, 0.5)).toBeGreaterThan(10);
  });

  it("the opacity falls to nothing", () => {
    expect(ribbonAlpha(0, 1.2)).toBe(1);
    expect(ribbonAlpha(1, 1.2)).toBe(0);
    expect(ribbonAlpha(0.5, 1)).toBe(0.5);
    expect(ribbonAlpha(0.5, 2)).toBeCloseTo(0.25, 6);
  });

  it("a gradient blends between evenly spaced stops", () => {
    const out = new Float32Array(3);
    gradientAt([1, 0, 0, 0, 0, 1], 0, out, 0);
    expect(Array.from(out)).toEqual([1, 0, 0]);
    gradientAt([1, 0, 0, 0, 0, 1], 1, out, 0);
    expect(Array.from(out)).toEqual([0, 0, 1]);
    gradientAt([1, 0, 0, 0, 0, 1], 0.5, out, 0);
    expect(Array.from(out)).toEqual([0.5, 0, 0.5]);
    gradientAt([1, 0, 0, 0, 1, 0, 0, 0, 1], 0.5, out, 0);
    expect(Array.from(out)).toEqual([0, 1, 0]);
    gradientAt([0.2, 0.4, 0.6], 0.7, out, 0);
    expect(out[0]).toBeCloseTo(0.2, 6);
    expect(out[2]).toBeCloseTo(0.6, 6);
  });
});

describe("writeRibbon", () => {
  it("draws nothing with fewer than two points", () => {
    expect(ribbon(null, []).n).toBe(0);
    expect(ribbon(null, [[0, 0, 1]]).n).toBe(0);
    const { out } = ribbon(null, []);
    expect(allFinite(out)).toBe(true);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it("a head and a cap make a ribbon even with no history", () => {
    const { n, out } = ribbon({ x: 5, y: 5 }, []);
    expect(n).toBe(CAP_PAIRS + 1);
    expect(allFinite(out)).toBe(true);
  });

  it("is finite for a trail that has not moved at all", () => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 20; i++) pts.push([100, 100, 0.5 + i * 0.01]);
    const { out, n } = ribbon({ x: 100, y: 100 }, pts);
    expect(n).toBeGreaterThan(2);
    expect(allFinite(out)).toBe(true);
  });

  it("is finite through a U-turn and a jump back to the same spot", () => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 10; i++) pts.push([i * 10, 0, 0.5 + i * 0.01]);
    for (let i = 10; i >= 0; i--) pts.push([i * 10, 0, 0.6 + (10 - i) * 0.01]);
    const { out } = ribbon({ x: 0, y: 0 }, pts);
    expect(allFinite(out)).toBe(true);
  });

  it("the head is the widest part and the end of the tail reaches nothing", () => {
    // A straight line, the newest point at the head's side.
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 10; i++) pts.push([-(10 - i) * 20, 0, 0.1 + i * 0.1]);
    const { out, n } = ribbon({ x: 0, y: 0 }, pts, 1.1);
    expect(n).toBe(CAP_PAIRS + 1 + 10);
    const head = widthOf(out, CAP_PAIRS);
    expect(head).toBeCloseTo(20, 4);
    // The oldest point is exactly one life old: it is nothing.
    expect(widthOf(out, n - 1)).toBeCloseTo(0, 3);
    expect(pair(out, n - 1).l[6]).toBeCloseTo(0, 3);
    // And the width never grows along the tail.
    for (let k = CAP_PAIRS + 1; k < n; k++) {
      expect(widthOf(out, k)).toBeLessThanOrEqual(widthOf(out, k - 1) + 1e-4);
    }
  });

  it("the cap rounds the head: it lies past the head and is narrower", () => {
    const { out } = ribbon({ x: 0, y: 0 }, [
      [-20, 0, 0.9],
      [-40, 0, 0.8],
    ]);
    const tip = pair(out, 0);
    const head = pair(out, CAP_PAIRS);
    expect(tip.l[0]).toBeGreaterThan(0);
    expect(widthOf(out, 0)).toBeLessThan(widthOf(out, CAP_PAIRS));
    expect(head.l[6]).toBeCloseTo(1, 5);
    expect(tip.l[6]).toBeCloseTo(1, 5);
  });

  it("colours run from the first stop at the head to the last at the tail", () => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i < 10; i++) pts.push([-(10 - i) * 20, 0, 0.1 + i * 0.1]);
    const { out, n } = ribbon({ x: 0, y: 0 }, pts, 1.1);
    const head = pair(out, CAP_PAIRS).l;
    const tail = pair(out, n - 1).l;
    expect([head[3], head[4], head[5]]).toEqual([1, 0, 0]);
    expect(tail[5]).toBeGreaterThan(0.95);
    expect(tail[3]).toBeLessThan(0.05);
  });

  it("with no head the ribbon starts at the newest point, already part way along its fade", () => {
    const { out, n } = ribbon(null, [
      [-40, 0, 0.5],
      [-20, 0, 0.7],
    ]);
    expect(n).toBe(2);
    const first = pair(out, 0).l;
    expect(first[6]).toBeLessThan(1);
    expect(first[6]).toBeGreaterThan(0);
  });

  it("the unused rest is degenerate and invisible", () => {
    const { out, n } = ribbon({ x: 0, y: 0 }, [[-10, 0, 0.9]]);
    const lastReal = pair(out, n - 1);
    for (let k = n; k < PAIRS; k++) {
      const p = pair(out, k);
      expect(p.l.slice(0, 2)).toEqual(lastReal.l.slice(0, 2));
      expect(p.r.slice(0, 2)).toEqual(lastReal.r.slice(0, 2));
      expect(p.l[6]).toBe(0);
      expect(p.r[6]).toBe(0);
    }
  });

  it("never writes past the room it was given", () => {
    const h = new TrailHistory(40);
    for (let i = 0; i < 40; i++) h.push(i, 0, i * 0.01);
    const out = new Float32Array(20 * 2 * VERTEX_FLOATS + 100).fill(7);
    writeRibbon(out, 0, 20, { x: 50, y: 0 }, h, 0.4, style);
    for (let i = 20 * 2 * VERTEX_FLOATS; i < out.length; i++) expect(out[i]).toBe(7);
  });
});
