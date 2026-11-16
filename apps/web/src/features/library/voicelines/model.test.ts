import { describe, expect, it } from "vitest";

import {
  VOICELINES_ROUTE,
  clock,
  defaultTranslation,
  downloadName,
  filterLines,
  foldText,
  lineParam,
  lineStem,
  pad,
  parseTranslation,
  shortLength,
  targetOfId,
  totalLength,
  translationOf,
  translationOptions,
  voicelinesRoute,
} from "./model";
import type { VoiceCharacterFile, VoiceLine } from "./types";

const line = (n: number, t: string, extra: Partial<VoiceLine> = {}): VoiceLine => ({
  n,
  t,
  d: 2,
  ...extra,
});

const FILE: VoiceCharacterFile = {
  v: 2,
  slug: "fanny",
  name: "Fanny",
  card: {
    jp: "ファニー",
    romaji: null,
    aspirant: "Blade",
    palette: { primary: "#f5862a", secondary: "#000000", glow: "#ffffff", ink: "#000000" },
  },
  full: { id: "voice-fanny-full", m4a: "voicelines/fanny/full.m4a", d: 100, note: "" },
  langs: {
    jp: [line(1, "あ", { tr: "Ah." }), line(2, "い", { tr: "Ee." })],
    en: [line(1, "Hello"), line(2, "Bye")],
    id: [line(1, "Halo"), line(2, "Sampai jumpa")],
    ar: [line(1, "مرحبا"), line(2, "وداعا")],
    es: [line(1, "Hola"), { n: 2, t: "Adiós" }],
    pt: [line(1, "Olá"), line(2, "Tchau")],
    tr: [line(1, "Merhaba"), line(2, "Hoşça kal")],
    ru: [line(1, "Привет"), line(2, "Пока")],
  },
};

const JP = FILE.langs.jp;
const ES = FILE.langs.es;
const RU = FILE.langs.ru;

describe("addresses", () => {
  it("make the room and the page of an Aspirant, the language and the line being parameters of one page", () => {
    expect(VOICELINES_ROUTE).toBe("/collection/voicelines");
    expect(voicelinesRoute("fanny")).toBe("/collection/voicelines/fanny");
    expect(voicelinesRoute("fanny", { lang: "es" })).toBe("/collection/voicelines/fanny?lang=es");
    expect(voicelinesRoute("change", { lang: "jp", line: 5 })).toBe(
      "/collection/voicelines/change?lang=jp&i=05",
    );
  });

  it("read a line number", () => {
    expect(lineParam("05")).toBe(5);
    expect(lineParam("12")).toBe(12);
    expect(lineParam("")).toBeNull();
    expect(lineParam("voice-trailer-01")).toBeNull();
    expect(lineParam(null)).toBeNull();
    expect(lineParam("0")).toBeNull();
  });
});

describe("keys and file names", () => {
  it("keep the Japanese keys of the first version and put the other languages under their own", () => {
    expect(lineStem("fanny", "jp", 5)).toBe("voicelines/fanny/05");
    expect(lineStem("fanny", "en", 5)).toBe("voicelines/fanny/en/05");
    expect(lineStem("change", "ru", 37)).toBe("voicelines/change/ru/37");
  });

  it("name a saved file after the Aspirant, the language and the line, with no character a system refuses", () => {
    expect(downloadName("Fanny", "en", 5, "flac")).toBe("Fanny - English - 05.flac");
    expect(downloadName("Chang'e", "jp", 12, "mp3")).toBe("Chang'e - Japanese - 12.mp3");
    expect(downloadName("A/B:C?", "es", 1, "flac")).toBe("ABC - Spanish - 01.flac");
    expect(pad(3)).toBe("03");
  });
});

describe("time", () => {
  it("is a clock, a short length and a total", () => {
    expect(clock(42)).toBe("0:42");
    expect(clock(65)).toBe("1:05");
    expect(clock(3725)).toBe("1:02:05");
    expect(shortLength(2.449)).toBe("2.4 s");
    expect(shortLength(12)).toBe("0:12");
    expect(totalLength(600)).toBe("10 min");
    expect(totalLength(9968)).toBe("2.8 h");
  });
});

describe("translations", () => {
  it("offer the other six languages of the shared list to each of them, and Japanese only its own English", () => {
    expect(translationOptions("jp")).toEqual(["en"]);
    expect(translationOptions("en")).toEqual(["id", "ar", "es", "pt", "tr", "ru"]);
    expect(translationOptions("es")).not.toContain("es");
    expect(translationOptions("es")).not.toContain("jp");
  });

  it("default to English, except for English itself", () => {
    expect(defaultTranslation("jp")).toBe("en");
    expect(defaultTranslation("es")).toBe("en");
    expect(defaultTranslation("en")).toBe("");
  });

  it("are read from an address: a language the page can offer, `off`, or the default", () => {
    expect(parseTranslation("ru", "es")).toBe("ru");
    expect(parseTranslation("off", "es")).toBe("");
    expect(parseTranslation("", "es")).toBe("en");
    expect(parseTranslation("es", "es")).toBe("en");
    expect(parseTranslation("id", "jp")).toBe("en");
    expect(parseTranslation(null, "en")).toBe("");
  });

  it("give the English translation of a Japanese line, and the same line of another language otherwise", () => {
    const jp1 = JP[0]!;
    expect(translationOf(FILE, "jp", jp1, "en")).toEqual({ lang: "en", text: "Ah.", line: null });
    expect(translationOf(FILE, "jp", jp1, "id")).toBeNull();
    const es1 = ES[0]!;
    expect(translationOf(FILE, "es", es1, "ru")?.text).toBe("Привет");
    expect(translationOf(FILE, "es", es1, "ru")?.line?.n).toBe(1);
    expect(translationOf(FILE, "es", es1, "")).toBeNull();
    // A line with no recording in the other language still gives its text, and no line to play.
    const ru2 = RU[1]!;
    expect(translationOf(FILE, "ru", ru2, "es")).toEqual({ lang: "es", text: "Adiós", line: null });
  });
});

describe("search", () => {
  it("ignores case and accents, and finds a line by a word of the text or by its number", () => {
    expect(foldText("Türkçe İstanbul")).toBe("turkce istanbul");
    expect(foldText("ПРИВЕТ")).toBe("привет");
    const lines = FILE.langs.tr;
    expect(filterLines(lines, "hos").map((l) => l.n)).toEqual([2]);
    expect(filterLines(lines, "MERHABA").map((l) => l.n)).toEqual([1]);
    expect(filterLines(lines, "02").map((l) => l.n)).toEqual([2]);
    expect(filterLines(lines, "")).toHaveLength(2);
    expect(filterLines(lines, "zzz")).toEqual([]);
  });

  it("looks in the translation too, and wants every word", () => {
    const tr = (l: VoiceLine) => l.tr ?? "";
    expect(filterLines(JP, "ee", tr).map((l) => l.n)).toEqual([2]);
    expect(filterLines(JP, "ah ee", tr)).toEqual([]);
  });
});

describe("old addresses and search results", () => {
  const slugOf = (id: string) =>
    id.includes("selena") ? "selena" : id.includes("trailer") ? "ruby" : "fanny";

  it("point at a Japanese line, an English line, a recording or a trailer clip", () => {
    expect(targetOfId("voice-fanny-03", slugOf)).toEqual({
      slug: "fanny",
      lang: "jp",
      line: 3,
      group: "line",
    });
    expect(targetOfId("voice-fanny-en-12", slugOf)).toEqual({
      slug: "fanny",
      lang: "en",
      line: 12,
      group: "line",
    });
    expect(targetOfId("voice-fanny-full", slugOf)).toEqual({
      slug: "fanny",
      lang: "jp",
      line: null,
      group: "compilation",
    });
    expect(targetOfId("voice-trailer-04", slugOf)).toEqual({
      slug: "ruby",
      lang: "jp",
      line: 4,
      group: "trailer",
    });
    expect(targetOfId("voice-selena-trailer-17", slugOf)).toEqual({
      slug: "selena",
      lang: "jp",
      line: 17,
      group: "trailer",
    });
  });

  it("point at nothing when the id is not one of the room's, or the index does not know it", () => {
    expect(targetOfId("arts-official-layla", slugOf)).toBeNull();
    expect(targetOfId("voice-fanny-03", () => null)).toBeNull();
  });
});
