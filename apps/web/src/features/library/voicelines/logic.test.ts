import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  clock,
  downloadName,
  fold,
  groupItems,
  matchesQuery,
  nextAfter,
  playOrder,
  randomFrom,
  searchText,
  shortLength,
  totalLength,
} from "./logic";
import type { VoiceCharacter, VoiceItem, VoicelinesFile } from "./types";

function load(): VoicelinesFile {
  const file = path.resolve(__dirname, "../../../../public/data/library/voicelines.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as VoicelinesFile;
}

function item(over: Partial<VoiceItem>): VoiceItem {
  return {
    id: "voice-layla-01",
    title: "Layla: Hello",
    collection: "voicelines",
    chars: ["layla"],
    pair: "fanny-layla",
    canon: "official",
    tags: [],
    slug: "layla",
    n: 1,
    jp: "こんにちは",
    en: "Hello there.",
    m4a: "voicelines/layla/01.m4a",
    flac: "voicelines/layla/01.flac",
    dur: 1.5,
    group: "line",
    ...over,
  };
}

const characters = [
  { slug: "layla", name: "Layla" },
  { slug: "fanny", name: "Fanny" },
] as VoiceCharacter[];

describe("search", () => {
  it("folds full width letters and case", () => {
    expect(fold("ＡＢＣ")).toBe("abc");
  });

  it("finds a line by the name, the Japanese or the English, with every word needed", () => {
    const hay = searchText(item({}), "Layla");
    expect(matchesQuery(hay, "layla hello")).toBe(true);
    expect(matchesQuery(hay, "こんにち")).toBe(true);
    expect(matchesQuery(hay, "hello goodbye")).toBe(false);
    expect(matchesQuery(hay, "")).toBe(true);
  });

  it("groups lines by character and keeps compilations out of the search", () => {
    const items = [
      item({ id: "a", en: "Wind and sky" }),
      item({ id: "b", slug: "fanny", chars: ["fanny"], en: "Fire" }),
      item({ id: "c", group: "compilation", en: "", jp: "" }),
      item({ id: "d", group: "trailer", speaker: "Ruby", slug: "layla", en: "", sub: "Stop!" }),
    ];
    const all = groupItems(items, characters, "");
    expect(all.lines.layla?.map((i) => i.id)).toEqual(["a"]);
    expect(all.compilations.layla?.id).toBe("c");
    expect(all.trailer.map((i) => i.id)).toEqual(["d"]);
    const some = groupItems(items, characters, "fire");
    expect(some.lines.layla).toBeUndefined();
    expect(some.lines.fanny?.map((i) => i.id)).toEqual(["b"]);
    expect(some.compilations.layla?.id).toBe("c");
    expect(groupItems(items, characters, "stop").trailer).toHaveLength(1);
  });
});

describe("play order", () => {
  const items = [
    item({ id: "f1", slug: "fanny", chars: ["fanny"] }),
    item({ id: "l1" }),
    item({ id: "l2" }),
    item({ id: "t1", group: "trailer", slug: "ruby" }),
  ];
  const order = playOrder(groupItems(items, characters, ""), characters);

  it("lists the characters in order, then the trailer clips", () => {
    expect(order.map((i) => i.id)).toEqual(["l1", "l2", "f1", "t1"]);
  });

  it("plays the next row and wraps", () => {
    expect(nextAfter(order, null)?.id).toBe("l1");
    expect(nextAfter(order, "l1")?.id).toBe("l2");
    expect(nextAfter(order, "t1")?.id).toBe("l1");
    expect(nextAfter([], "x")).toBeNull();
  });

  it("picks a random row other than the one that plays", () => {
    expect(randomFrom(order, "l1", () => 0)?.id).toBe("l2");
    expect(randomFrom(order, "l1", () => 0.999)?.id).toBe("t1");
    expect(randomFrom([order[0]!], "l1")?.id).toBe("l1");
    expect(randomFrom([], null)).toBeNull();
  });
});

describe("formatting", () => {
  it("writes clocks and lengths", () => {
    expect(clock(126.7)).toBe("2:07");
    expect(shortLength(1.46)).toBe("1.5 s");
    expect(shortLength(126.7)).toBe("2:07");
    expect(totalLength(3494)).toBe("58 min");
    expect(totalLength(3900)).toBe("1 h 05 min");
  });

  it("names a download like the original file", () => {
    expect(downloadName(item({ n: 7, jp: "強い信念" }))).toBe("07_強い信念.flac");
    expect(downloadName(item({ n: 6, group: "trailer", jp: "嫌！いや？" }))).toBe(
      "trailer-06_嫌！いや？.flac",
    );
    expect(downloadName(item({ n: 1, jp: 'a/b:c*"d' }))).toBe("01_abcd.flac");
  });
});

describe("voicelines.json", () => {
  const data = load();

  it("holds 380 lines, ten compilations and sixteen trailer clips", () => {
    const count = (g: string) => data.items.filter((i) => i.group === g).length;
    expect(count("line")).toBe(380);
    expect(count("compilation")).toBe(10);
    expect(count("trailer")).toBe(16);
    expect(data.totals).toMatchObject({ lines: 380, compilations: 10, trailer: 16 });
    expect(data.characters).toHaveLength(10);
  });

  it("has unique ids and real durations", () => {
    expect(new Set(data.items.map((i) => i.id)).size).toBe(data.items.length);
    for (const i of data.items) {
      expect(i.dur, i.id).toBeGreaterThan(0);
      expect(i.m4a, i.id).toMatch(/^voicelines\/.+\.m4a$/u);
    }
  });

  it("keeps the Japanese of every line, and the English of every line that has a translation", () => {
    for (const i of data.items.filter((x) => x.group === "line")) {
      expect(i.jp.length, i.id).toBeGreaterThan(0);
      expect(i.en.length, i.id).toBeGreaterThan(0);
      expect(i.flac, i.id).toMatch(/\.flac$/u);
    }
  });

  it("matches the per character totals", () => {
    for (const c of data.characters) {
      const lines = data.items.filter((i) => i.group === "line" && i.slug === c.slug);
      expect(lines.length, c.slug).toBe(c.lines);
      expect(
        data.items.some((i) => i.id === c.full),
        c.slug,
      ).toBe(true);
    }
  });

  it("carries the three notes", () => {
    const note = (id: string) => data.items.find((i) => i.id === id)?.note ?? "";
    expect(note("voice-lesley-36")).toContain("Chang'e");
    expect(note("voice-lesley-37")).toContain("Chang'e");
    expect(note("voice-vexana-42")).toContain("cut off");
    expect(note("voice-guinevere-30")).toContain("Vexana");
    expect(note("voice-vexana-31")).toContain("Guinevere");
  });

  it("labels the trailer clips as untranslated and links them to the trailer", () => {
    for (const i of data.items.filter((x) => x.group === "trailer")) {
      expect(i.en, i.id).toBe("");
      expect(i.note, i.id).toContain("No official translation");
      expect(i.film, i.id).toBe("film-ruby-and-angela-video-trailer-trailer-final");
      expect(i.t, i.id).toBeGreaterThan(0);
    }
  });

  it("links the trailer clips to a film that exists in films.json (when the Films room has been built)", () => {
    const films = path.resolve(__dirname, "../../../../public/data/library/films.json");
    if (!fs.existsSync(films)) return;
    const ids = new Set(
      (JSON.parse(fs.readFileSync(films, "utf8")) as { items: Array<{ id: string }> }).items.map(
        (i) => i.id,
      ),
    );
    for (const i of data.items.filter((x) => x.group === "trailer"))
      expect(ids.has(i.film ?? "")).toBe(true);
  });

  it("uses no dashes and no banned word", () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u"),
    );
    expect(text.toLowerCase()).not.toContain("con" + "viction");
  });
});
