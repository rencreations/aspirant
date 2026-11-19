import { describe, expect, it } from "vitest";

import { BACKDROP_KINDS, BACKDROP_PALETTES } from "../fx/backdrop";

import {
  BACKDROP_AT,
  BACKDROP_KINDS_USED,
  INK_ENTRANCE_S,
  INK_INTENSITY,
  INK_LEVEL,
  backdropAt,
  inkEntrance,
  stepInkEntrance,
} from "./backdrops";
import { STORY } from "./story";

describe("the backdrop of the first four sections", () => {
  it("has none for the hero and the wall: the ground is the plain daybreak off white", () => {
    for (const S of [-1, 0, 0.5, 1, 2, 3, 3.29, 4.5, 5.29]) expect(backdropAt(S)).toBeNull();
  });

  it("is light on the daybreak ground all the way (the home page is light only)", () => {
    for (const S of [5.3, 5.5, 6.5, 7.7, 8.5, 10, 12]) {
      expect(backdropAt(S)?.options.theme).toBe("daybreak");
    }
  });

  it("changes kind only at the places it says, in order, and never returns", () => {
    const seen: string[] = [];
    for (let S = -1; S <= 14; S += 0.01) {
      const kind = backdropAt(S)?.kind ?? "none";
      if (seen[seen.length - 1] !== kind) seen.push(kind);
    }
    expect(seen).toEqual(["none", "silk", "ink-field"]);
  });

  it("changes to the strip's mist where the rows' transition ends (the silk has gone by then: no flash)", () => {
    expect(BACKDROP_AT.ink).toBe(STORY.rows.start + STORY.rows.length);
  });

  it("is the ink field all the way from the rows' transition to the end of the strip's story (the window, the orbit)", () => {
    for (const S of [BACKDROP_AT.ink, STORY.strip.start, STORY.strip.start + 1.7, 10.8]) {
      expect(backdropAt(S)?.kind).toBe("ink-field");
    }
  });

  it("uses kinds the backdrop has, with palettes for the ground it asks", () => {
    for (const kind of BACKDROP_KINDS_USED) {
      expect(BACKDROP_KINDS).toContain(kind);
      expect(BACKDROP_PALETTES[kind].daybreak).toBeDefined();
    }
  });

  it("returns the same object for the same station (nothing is allocated per frame)", () => {
    expect(backdropAt(3.5)).toBe(backdropAt(5));
    expect(backdropAt(9)).toBe(backdropAt(10));
  });

  it("has nothing behind the owner's words on the wall, and a calm silk under the rows", () => {
    expect(backdropAt(4.4)).toBeNull();
    expect(backdropAt(5.4)?.options.amount).toBeLessThanOrEqual(0.5);
  });
});

describe("the strip's mist comes in slowly", () => {
  it("rises from nothing to the steady level over its own few seconds, starting very gently", () => {
    expect(inkEntrance(0)).toBe(0);
    expect(inkEntrance(INK_ENTRANCE_S)).toBe(1);
    expect(INK_ENTRANCE_S).toBeGreaterThanOrEqual(3);
    expect(INK_ENTRANCE_S).toBeLessThanOrEqual(4.5);
    // Nobody sees it begin: a tenth of the time is under half a percent of the level.
    expect(inkEntrance(0.1 * INK_ENTRANCE_S)).toBeLessThan(0.01);
    let last = 0;
    for (let t = 0; t <= INK_ENTRANCE_S; t += 0.05) {
      const v = inkEntrance(t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("runs on its own clock and ends on its level and intensity", () => {
    const spec = backdropAt(8);
    for (let i = 0; i < 20; i++) stepInkEntrance(0.05, false);
    expect(spec?.options.amount).toBe(0);
    for (let i = 0; i < 40; i++) stepInkEntrance(0.05, true);
    const half = spec?.options.amount ?? 0;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(INK_LEVEL);
    for (let i = 0; i < 100; i++) stepInkEntrance(0.05, true);
    expect(spec?.options.amount).toBeCloseTo(INK_LEVEL, 9);
    expect(spec?.options.intensity).toBe(INK_INTENSITY);
    // A frame that stood still (dt 0) moves nothing, a long one counts for a tenth of a second.
    stepInkEntrance(0, false);
    expect(spec?.options.amount).toBeCloseTo(INK_LEVEL, 9);
    for (let i = 0; i < 30; i++) stepInkEntrance(0.05, false);
    expect(spec?.options.amount).toBe(0);
  });
});
