import { describe, expect, it } from "vitest";

import { KIND_INFO, MARK_KINDS, PRIM, defaultDirection } from "./kinds";
import { colorHex, writeColor } from "./palette";
import { marksItems } from "./preload";

describe("kinds", () => {
  it("every kind has its info, and the shape numbers are all different", () => {
    for (const kind of MARK_KINDS) {
      const info = KIND_INFO[kind];
      expect(info.size).toBeGreaterThan(0);
      expect(info.count).toBeGreaterThanOrEqual(1);
      expect(info.duration).toBeGreaterThan(0);
    }
    const nums = Object.values(PRIM);
    expect(new Set(nums).size).toBe(nums.length);
    expect(Math.max(...nums)).toBeLessThan(16);
  });

  it("a loop's rate is above zero, and a kind that loops by itself says how its marks behave", () => {
    for (const kind of MARK_KINDS) {
      const s = KIND_INFO[kind].sustain;
      if (s) expect(s.rate).toBeGreaterThan(0);
    }
    expect(KIND_INFO.air.sustain?.follow).toBe(true);
  });

  it("air runs up and the rest run right when nothing is said", () => {
    expect(defaultDirection("air")).toBeCloseTo(Math.PI / 2, 6);
    expect(defaultDirection("speed")).toBe(0);
  });
});

describe("palette", () => {
  it("writes the named colours of the site and any hex number", () => {
    const out = new Float32Array(6);
    writeColor("pink", out, 0);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0x2d / 255, 6);
    expect(out[2]).toBeCloseTo(0x7a / 255, 6);
    writeColor(0x0000ff, out, 3);
    expect(Array.from(out.slice(3))).toEqual([0, 0, 1]);
    expect(colorHex("ink")).toBe(0x0b0d12);
    expect(colorHex(0x123456)).toBe(0x123456);
  });
});

describe("loading", () => {
  it("the marks and the trails need no file", () => {
    expect(marksItems()).toEqual([]);
  });
});
