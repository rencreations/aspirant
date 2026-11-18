import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANG_IDS } from "./languages";
import { lineStem } from "./model";
import type { VoiceCharacterFile } from "./types";

/**
 * The curated lines of the home page (`public/data/home/voices.json`, made by
 * `scripts/home/media/voices.py`) are copies of records of the Voicelines data. They must stay equal
 * to them, gain included, or the home would play a line at another level than the room does.
 */
const PUBLIC = path.resolve(import.meta.dirname, "../../../../public/data");

interface HomeLine {
  n: number;
  lang: string;
  dir: "ltr" | "rtl";
  t: string;
  tr?: string;
  trLang?: string;
  d: number;
  g: number;
  key: string;
}
interface HomeVoices {
  languages: Array<{ id: string; html: string; dir: string }>;
  characters: Array<{
    slug: string;
    line: number;
    lineJp: number;
    lines: Record<string, HomeLine>;
  }>;
}

const home = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, "home", "voices.json"), "utf8"),
) as HomeVoices;

const ORDER = [
  ["fanny", 18],
  ["ruby", 5],
  ["lesley", 2],
  ["guinevere", 39],
  ["selena", 43],
  ["layla", 7],
  ["angela", 23],
  ["change", 12],
  ["vexana", 41],
  ["obsidia", 18],
] as const;

// The home order of the languages: Japanese, English, then the rest of the room's table.
const HOME_LANGS = ["jp", "en", ...LANG_IDS.filter((l) => l !== "jp" && l !== "en")];

describe("the home page's voice lines", () => {
  it("are the owner's ten, in the owner's order, in eight languages with Japanese first", () => {
    expect(home.characters.map((c) => [c.slug, c.line])).toEqual(ORDER.map((o) => [...o]));
    expect(home.languages.map((l) => l.id)).toEqual([
      "jp",
      "en",
      "id",
      "ar",
      "es",
      "pt",
      "tr",
      "ru",
    ]);
    expect(new Set(HOME_LANGS)).toEqual(new Set(LANG_IDS));
    for (const c of home.characters) {
      expect(Object.keys(c.lines)).toEqual(["jp", "en", "id", "ar", "es", "pt", "tr", "ru"]);
    }
  });

  it("number Selena's Japanese line 42 and every other line as the owner gave it", () => {
    for (const c of home.characters) {
      expect(c.lines.jp?.n).toBe(c.slug === "selena" ? 42 : c.line);
      for (const lang of ["en", "id", "ar", "es", "pt", "tr", "ru"])
        expect(c.lines[lang]?.n).toBe(c.line);
    }
  });

  it("are the records of the library, with the same text, duration, key and gain", () => {
    for (const c of home.characters) {
      const file = JSON.parse(
        fs.readFileSync(path.join(PUBLIC, "library", `voicelines-${c.slug}.json`), "utf8"),
      ) as VoiceCharacterFile;
      for (const [lang, rec] of Object.entries(c.lines)) {
        const src = file.langs[lang as keyof typeof file.langs].find((l) => l.n === rec.n);
        expect(src, `${c.slug} ${lang}`).toBeDefined();
        expect(rec.t).toBe(src?.t);
        expect(rec.d).toBe(src?.d);
        expect(rec.g).toBe(src?.g);
        expect(rec.key).toBe(`${lineStem(c.slug, lang as keyof typeof file.langs, rec.n)}.m4a`);
      }
    }
  });

  it("carry the language and the direction of their own text (Arabic reads right to left)", () => {
    for (const c of home.characters) {
      for (const [lang, rec] of Object.entries(c.lines)) {
        expect(rec.lang).toBe(lang === "jp" ? "ja" : lang);
        expect(rec.dir).toBe(lang === "ar" ? "rtl" : "ltr");
      }
    }
  });
});
