import { describe, expect, it } from "vitest";

import { neighbours, THEME_FADE, themeLabel, themeMove } from "./plan";

describe("themeMove", () => {
  it("keeps a song that goes on (two characters of a pair)", () => {
    expect(themeMove("music-we-believe", "music-we-believe")).toEqual({ kind: "keep" });
    expect(themeMove(null, null)).toEqual({ kind: "keep" });
  });

  it("starts the first song at once, with a slow fade in", () => {
    expect(themeMove(null, "music-gray-new-world")).toEqual({
      kind: "start",
      fadeMs: THEME_FADE.in,
      delayMs: 0,
    });
  });

  it("cross fades into a new song once the ring has rested on it", () => {
    expect(themeMove("music-gray-new-world", "music-lullaby-of-oblivion")).toEqual({
      kind: "cross",
      fadeMs: THEME_FADE.cross,
      delayMs: THEME_FADE.settle,
    });
  });

  it("fades out at once when the room is left, after a rest inside it", () => {
    expect(themeMove("music-we-believe", null, true)).toEqual({
      kind: "stop",
      fadeMs: THEME_FADE.out,
      delayMs: 0,
    });
    expect(themeMove("music-we-believe", null)).toEqual({
      kind: "stop",
      fadeMs: THEME_FADE.out,
      delayMs: THEME_FADE.settle,
    });
  });

  it("fades over times a visitor hears as smooth, never a cut", () => {
    for (const ms of [THEME_FADE.in, THEME_FADE.cross, THEME_FADE.out]) {
      expect(ms).toBeGreaterThanOrEqual(800);
      expect(ms).toBeLessThanOrEqual(2500);
    }
  });
});

describe("themeLabel", () => {
  it("names the song and who made its music", () => {
    expect(
      themeLabel({
        id: "x",
        title: "We Believe!",
        src: "music/we-believe.m4a",
        credits: [
          { role: "Lyrics", name: "Funta7" },
          { role: "Music", name: "Yasuharu Takanashi" },
        ],
      }),
    ).toEqual({ title: "We Believe!", artist: "Yasuharu Takanashi" });
  });

  it("falls back to the first credit, then to the series", () => {
    expect(
      themeLabel({ id: "x", title: "T", src: "s", credits: [{ role: "Vocals", name: "A" }] })
        .artist,
    ).toBe("A");
    expect(themeLabel({ id: "x", title: "T", src: "s" }).artist).toBe("The Aspirants");
  });
});

describe("neighbours", () => {
  it("gives the next character and the one before, round the ring", () => {
    expect(neighbours(0, 10)).toEqual([1, 9]);
    expect(neighbours(9, 10)).toEqual([0, 8]);
    expect(neighbours(0, 2)).toEqual([1]);
    expect(neighbours(0, 1)).toEqual([]);
  });
});
