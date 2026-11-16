import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHARACTER_SLUGS } from "@/lib/slugs";

import {
  ALIGNED_LANGS,
  DEFAULT_LANG,
  LANGUAGES,
  LANG_IDS,
  isLangId,
  langInfo,
  parseLang,
} from "./languages";
import type { VoiceCharacterFile, VoiceIndex } from "./types";

const DATA = path.resolve(import.meta.dirname, "../../../../public/data/library");

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8")) as T;
}

describe("the languages", () => {
  it("are the eight of the room, in the order of the shortcuts, and Japanese is the default", () => {
    expect(LANG_IDS).toEqual(["en", "id", "jp", "ar", "es", "pt", "tr", "ru"]);
    expect(LANGUAGES.map((l) => l.id)).toEqual([...LANG_IDS]);
    expect(DEFAULT_LANG).toBe("jp");
    expect(ALIGNED_LANGS).toEqual(["en", "id", "ar", "es", "pt", "tr", "ru"]);
  });

  it("name themselves, and Arabic reads right to left", () => {
    expect(LANGUAGES.map((l) => l.name)).toEqual([
      "English",
      "Bahasa Indonesia",
      "日本語",
      "اللغة العربية",
      "español",
      "português",
      "türkçe",
      "русский",
    ]);
    expect(LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.id)).toEqual(["ar"]);
    expect(langInfo("jp").html).toBe("ja");
  });

  it("are read from an address: jp, ja (the code of the language) and any case; anything else is Japanese", () => {
    expect(parseLang("jp")).toBe("jp");
    expect(parseLang("ja")).toBe("jp");
    expect(parseLang("JP")).toBe("jp");
    expect(parseLang(" ES ")).toBe("es");
    expect(parseLang("ru")).toBe("ru");
    expect(parseLang("fr")).toBe("jp");
    expect(parseLang("")).toBe("jp");
    expect(parseLang(null)).toBe("jp");
    expect(isLangId("ja")).toBe(false);
  });
});

describe("the data the pipeline wrote", () => {
  it("has the same table of languages as languages.ts", () => {
    const index = read<VoiceIndex>("voicelines");
    expect(index.languages.map((l) => l.id)).toEqual([...LANG_IDS]);
    for (const lang of index.languages) {
      const info = langInfo(lang.id);
      expect([lang.native, lang.english, lang.html, lang.dir, lang.flag]).toEqual([
        info.name,
        info.english,
        info.html,
        info.dir,
        info.flag,
      ]);
    }
  });

  it("has ten Aspirants in the room and one file for each", () => {
    const index = read<VoiceIndex>("voicelines");
    expect(index.characters.map((c) => c.slug).sort()).toEqual([...CHARACTER_SLUGS].sort());
    for (const slug of CHARACTER_SLUGS) {
      const file = read<VoiceCharacterFile>(`voicelines-${slug}`);
      expect(file.slug).toBe(slug);
      expect(Object.keys(file.langs).sort()).toEqual([...LANG_IDS].sort());
    }
  });

  it("keeps line N the same line in the seven languages that share a list, and every line has its recording", () => {
    for (const slug of CHARACTER_SLUGS) {
      const file = read<VoiceCharacterFile>(`voicelines-${slug}`);
      const counts = ALIGNED_LANGS.map((id) => file.langs[id].length);
      expect(new Set(counts).size, `${slug}: ${counts.join(",")}`).toBe(1);
      for (const id of LANG_IDS) {
        const lines = file.langs[id];
        expect(
          lines.map((l) => l.n),
          `${slug} ${id}`,
        ).toEqual(lines.map((_, i) => i + 1));
        for (const line of lines) {
          expect(line.t.trim(), `${slug} ${id} ${line.n}`).not.toBe("");
          expect(line.d, `${slug} ${id} ${line.n} has no recording`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gives the Japanese list its own English translation, never the other languages' lines", () => {
    for (const slug of CHARACTER_SLUGS) {
      const file = read<VoiceCharacterFile>(`voicelines-${slug}`);
      for (const line of file.langs.jp) expect(line.tr?.trim(), `${slug} ${line.n}`).toBeTruthy();
      for (const id of ALIGNED_LANGS) {
        for (const line of file.langs[id]) expect(line.tr).toBeUndefined();
      }
    }
  });

  it("has a recording for each Aspirant and a card to colour her page", () => {
    for (const slug of CHARACTER_SLUGS) {
      const file = read<VoiceCharacterFile>(`voicelines-${slug}`);
      expect(file.full.m4a).toBe(`voicelines/${slug}/full.m4a`);
      expect(file.full.d).toBeGreaterThan(30);
      expect(file.card.palette.primary).toMatch(/^#[0-9a-f]{6}$/iu);
    }
  });
});
