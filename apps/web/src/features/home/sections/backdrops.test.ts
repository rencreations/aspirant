import { describe, expect, it } from "vitest";

import { BACKDROP_KINDS, BACKDROP_PALETTES } from "../fx/backdrop";

import { BACKDROP_AT, BACKDROP_KINDS_USED, backdropAt } from "./backdrops";
import { STORY } from "./story";

describe("the backdrop of the first four sections", () => {
  it("has none for the hero and the wall: the ground is the plain daybreak off white", () => {
    for (const S of [-1, 0, 0.5, 1, 2, 3, 3.29, 4.5, 5.29]) expect(backdropAt(S)).toBeNull();
  });

  it("is light and airy on the daybreak ground and dark and rich on the storm one", () => {
    for (const S of [5.3, 5.5, 6.5]) expect(backdropAt(S)?.options.theme).toBe("daybreak");
    for (const S of [7.7, 8.5, 10, 12]) expect(backdropAt(S)?.options.theme).toBe("storm");
  });

  it("changes kind only at the places it says, in order, and never returns", () => {
    const seen: string[] = [];
    for (let S = -1; S <= 14; S += 0.01) {
      const kind = backdropAt(S)?.kind ?? "none";
      if (seen[seen.length - 1] !== kind) seen.push(kind);
    }
    expect(seen).toEqual(["none", "silk", "ink-field"]);
  });

  it("turns dark where the rows' transition ends (the ground and the silk have gone by then: no flash)", () => {
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
      expect(BACKDROP_PALETTES[kind].storm).toBeDefined();
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
