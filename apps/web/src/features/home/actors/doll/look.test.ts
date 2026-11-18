import { describe, expect, it } from "vitest";

import { TOON_LOOKS } from "../shared/toon";

import { INK_BOOST, INK_SLOPE, PART_LOOKS, inkBoost, trimLook } from "./look";
import { PART } from "./parts";

describe("the doll's looks", () => {
  it("has one look for each part: cloth and skin in two bands, hair in three", () => {
    for (const part of [PART.cloth, PART.skin, PART.hair]) {
      const spec = PART_LOOKS[part];
      const look = { ...TOON_LOOKS[spec.look], ...spec.tune };
      expect([2, 3]).toContain(look.bands);
      expect(look.soft).toBeGreaterThan(0);
    }
    expect(TOON_LOOKS[PART_LOOKS[PART.hair].look].bands).toBe(3);
    expect(TOON_LOOKS[PART_LOOKS[PART.skin].look].glint).toBe(0);
  });
});

describe("inkBoost", () => {
  it("is 1 for a small figure, the whole boost for a big one, and grows between", () => {
    expect(inkBoost(60)).toBe(1);
    expect(inkBoost(100)).toBe(1);
    expect(inkBoost(250)).toBeCloseTo(1 + (INK_BOOST - 1) / 2, 10);
    expect(inkBoost(400)).toBe(INK_BOOST);
    expect(inkBoost(2000)).toBe(INK_BOOST);
  });

  it("keeps the depth push several line widths deep", () => {
    expect(INK_SLOPE).toBeGreaterThanOrEqual(4);
  });
});

describe("trimLook", () => {
  it("scales the lit colour by direct and the shades by ambient, and leaves the rest", () => {
    const base = TOON_LOOKS.hair;
    const out = trimLook(base, 0.5, 2);
    expect(out.lit[0]).toBeCloseTo(base.lit[0] * 0.5, 10);
    expect(out.shade[1]).toBeCloseTo(base.shade[1] * 2, 10);
    expect(out.deep[2]).toBeCloseTo(base.deep[2] * 2, 10);
    expect(out.cut).toBe(base.cut);
    expect(out.glint).toBe(base.glint);
    expect(trimLook(base, 1, 1)).toEqual(base);
  });
});
