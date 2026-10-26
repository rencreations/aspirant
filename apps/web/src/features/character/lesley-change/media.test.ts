import { describe, expect, it } from "vitest";

import { getCharacter } from "@/content/characters";
import {
  coverPoint,
  FILMS,
  HERO,
  MARKERS,
  officialArt,
  parsePosition,
  PARTNER,
  sourcesOf,
} from "./media";

describe("lesley and change media", () => {
  it("pairs the two pages", () => {
    expect(PARTNER.lesley).toBe("change");
    expect(PARTNER.change).toBe("lesley");
    expect(getCharacter("lesley").partnerSlug).toBe("change");
  });

  it("maps a picture point through a cover fit", () => {
    const pic = { w: 2000, h: 1000 };
    // Same ratio: shares map straight through.
    expect(coverPoint(0.5, 0.5, { w: 1000, h: 500 }, pic, { x: 0.5, y: 0.5 })).toEqual({
      x: 500,
      y: 250,
    });
    // A tall box crops the sides: the picture is scaled to 2000 wide, the box is 1000 wide.
    const p = coverPoint(0.5, 0.5, { w: 500, h: 1000 }, pic, { x: 0.5, y: 0.5 });
    expect(p.x).toBeCloseTo(250);
    expect(p.y).toBeCloseTo(500);
    // Position 0 keeps the left edge.
    expect(coverPoint(0, 0, { w: 500, h: 1000 }, pic, { x: 0, y: 0 }).x).toBe(0);
  });

  it("parses an object position", () => {
    expect(parsePosition("58% 40%")).toEqual({ x: 0.58, y: 0.4 });
  });

  it("keeps markers inside the picture and every film a single quality", () => {
    for (const m of MARKERS) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(1);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(1);
    }
    for (const f of Object.values(FILMS)) expect(sourcesOf(f)).toHaveLength(1);
  });

  it("puts a page's own art first in its gallery", () => {
    expect(officialArt("lesley")[0]?.src).toBe(HERO.lesley.src);
    expect(officialArt("change")[0]?.src).toBe(HERO.change.src);
    expect(officialArt("lesley")).toHaveLength(2);
  });
});
