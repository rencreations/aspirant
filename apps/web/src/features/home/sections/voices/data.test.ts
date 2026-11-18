import { describe, expect, it } from "vitest";

import { VOICE_PICKS } from "../../content";

import { VOICE_CHARACTERS, VOICE_LANGUAGES, splashLarge, splitDirections } from "./data";

describe("the curated voice lines", () => {
  it("lists the ten Aspirants in the owner's order", () => {
    expect(VOICE_CHARACTERS.map((c) => c.slug)).toEqual(VOICE_PICKS.map((p) => p.slug));
  });

  it("puts Japanese first, then English, then the others", () => {
    expect(VOICE_LANGUAGES.map((l) => l.id).slice(0, 2)).toEqual(["jp", "en"]);
    expect(VOICE_LANGUAGES).toHaveLength(8);
  });

  it("has one clip with a key, a gain and the right direction for every language", () => {
    for (const c of VOICE_CHARACTERS) {
      for (const l of VOICE_LANGUAGES) {
        const line = c.lines[l.id];
        expect(line, `${c.slug} ${l.id}`).toBeDefined();
        if (!line) continue;
        expect(line.key.startsWith(`voicelines/${c.slug}/`)).toBe(true);
        expect(line.key.endsWith(".m4a")).toBe(true);
        expect(Number.isFinite(line.g)).toBe(true);
        expect(line.d).toBeGreaterThan(0);
        expect(line.dir).toBe(l.dir);
        expect(line.t.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives Arabic a right to left direction", () => {
    expect(VOICE_LANGUAGES.find((l) => l.id === "ar")?.dir).toBe("rtl");
  });

  it("uses the owner's numbers (Selena's Japanese line is 42, the others 43)", () => {
    const selena = VOICE_CHARACTERS.find((c) => c.slug === "selena");
    expect(selena?.lines.jp?.n).toBe(42);
    expect(selena?.lines.en?.n).toBe(43);
  });

  it("has a small and a large picture for everybody", () => {
    for (const c of VOICE_CHARACTERS) {
      expect(c.splash).toBe(`/img/char/${c.slug}/splash-sm.webp`);
      expect(splashLarge(c.slug)).toBe(`/img/char/${c.slug}/splash.webp`);
    }
  });
});

describe("splitDirections", () => {
  it("leaves a plain line whole", () => {
    expect(splitDirections("Hello there")).toEqual([{ text: "Hello there", direction: false }]);
  });

  it("splits a stage direction out of a line", () => {
    expect(splitDirections("Who knew? (Chuckles) I did!")).toEqual([
      { text: "Who knew? ", direction: false },
      { text: "(Chuckles)", direction: true },
      { text: " I did!", direction: false },
    ]);
  });

  it("keeps the whole text when put back together", () => {
    for (const c of VOICE_CHARACTERS) {
      for (const l of VOICE_LANGUAGES) {
        const text = c.lines[l.id]?.t ?? "";
        expect(
          splitDirections(text)
            .map((p) => p.text)
            .join(""),
        ).toBe(text);
      }
    }
  });
});
