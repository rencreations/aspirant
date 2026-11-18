import { describe, expect, it } from "vitest";

import { BACKDROP_KINDS, BACKDROP_PALETTES } from "../fx/backdrop";

import { BACKDROP_AT, BACKDROP_KINDS_USED, backdropAt } from "./backdrops";
import { STORY } from "./story";

describe("the backdrop of the first four sections", () => {
  it("is light and airy on the daybreak ground and dark and rich on the storm one", () => {
    for (const S of [0, 1, 2, 3, 4, 4.5]) expect(backdropAt(S).options.theme).toBe("daybreak");
    for (const S of [5.3, 6, 7.7, 8.5, 10, 12]) expect(backdropAt(S).options.theme).toBe("storm");
  });

  it("changes kind only at the places it says, in order, and never returns", () => {
    const seen: string[] = [];
    for (let S = -1; S <= 14; S += 0.01) {
      const kind = backdropAt(S).kind;
      if (seen[seen.length - 1] !== kind) seen.push(kind);
    }
    expect(seen).toEqual(["soft-aurora", "silk", "beams", "threads"]);
  });

  it("turns dark with the wall's close, not before it, and not after the rows have started", () => {
    expect(BACKDROP_AT.beams).toBeGreaterThan(STORY.aspirants.start);
    expect(BACKDROP_AT.beams).toBeLessThan(STORY.rows.start);
  });

  it("is the threads once the orbit has been pulled in (the strip's pull begins at s 1.5)", () => {
    expect(BACKDROP_AT.threads).toBeGreaterThanOrEqual(STORY.strip.start + 1.5);
    expect(BACKDROP_AT.threads).toBeLessThanOrEqual(STORY.strip.start + 2.1);
  });

  it("uses kinds the backdrop has, with palettes for the ground it asks", () => {
    for (const kind of BACKDROP_KINDS_USED) {
      expect(BACKDROP_KINDS).toContain(kind);
      expect(BACKDROP_PALETTES[kind].daybreak).toBeDefined();
      expect(BACKDROP_PALETTES[kind].storm).toBeDefined();
    }
  });

  it("returns the same object for the same station (nothing is allocated per frame)", () => {
    expect(backdropAt(1)).toBe(backdropAt(2));
    expect(backdropAt(6)).toBe(backdropAt(8));
  });

  it("keeps the amount calm where the owner's words are on it", () => {
    expect(backdropAt(4.4).options.amount).toBeLessThanOrEqual(0.5);
  });
});
