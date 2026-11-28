import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { characters } from "@/content/characters";
import { FILM_IDS } from "@/features/library/video/links";

import {
  ABOUT_PICTURES,
  DRONE_CAPTION,
  EP_COUNT,
  FILM_COUNT,
  LABEL,
  LEDGER,
  NOTICE,
  PHASES,
  STATEMENT_LINES,
  STATEMENT_SOURCE,
  TIMELINE_YEARS,
  saleDay,
  saleMonth,
  timelineAt,
} from "./content";

const PUBLIC = path.resolve(import.meta.dirname, "../../../public");
const APP = path.resolve(import.meta.dirname, "../../app");

function library<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(PUBLIC, "data/library", file), "utf8")) as T;
}

/** Every string anywhere inside a value. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("the phases", () => {
  it("are five, in order, 1.0 to 5.0 and Phase I to Phase V", () => {
    expect(PHASES.map((p) => p.n)).toEqual([1, 2, 3, 4, 5]);
    expect(PHASES.map((p) => p.numeral)).toEqual(["1.0", "2.0", "3.0", "4.0", "5.0"]);
    expect(PHASES.map((p) => p.label)).toEqual([
      "Phase I",
      "Phase II",
      "Phase III",
      "Phase IV",
      "Phase V",
    ]);
  });

  it("went on sale in the order they are shown, inside the timeline's years", () => {
    const days = PHASES.map((p) => Date.UTC(p.sale.year, p.sale.month - 1, p.sale.day));
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    const at = PHASES.map(timelineAt);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const v of at) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(PHASES[0]?.sale.year).toBe(TIMELINE_YEARS[0]);
    expect(PHASES[4]?.sale.year).toBe(TIMELINE_YEARS[TIMELINE_YEARS.length - 1]);
  });

  it("write their dates in words", () => {
    const first = PHASES[0];
    if (!first) throw new Error("no first phase");
    expect(saleMonth(first)).toBe("January 2022");
    expect(saleDay(first)).toBe("22 January 2022");
  });

  it("hold the ten skins once each, named and titled as the character data has them", () => {
    const skins = PHASES.flatMap((p) => p.skins);
    expect(skins).toHaveLength(10);
    expect(new Set(skins.map((s) => s.slug)).size).toBe(10);
    for (const s of skins) {
      const character = characters.find((c) => c.slug === s.slug);
      expect(character, s.slug).toBeDefined();
      expect(s.name).toBe(character?.name);
      expect(s.title).toBe(character?.aspirantName);
      expect(s.href).toBe(`/character/${s.slug}`);
    }
  });

  it("give every phase the draw event, a film, an EP and its own face for the drone", () => {
    for (const p of PHASES) {
      expect(p.event).toBe("Aspirants Unite");
      expect(p.films.length).toBeGreaterThan(0);
      expect(p.music.length).toBeGreaterThan(0);
    }
    expect(new Set(PHASES.map((p) => p.face)).size).toBe(5);
    expect(PHASES.flatMap((p) => p.music.map((m) => m.ep))).toEqual([
      "EP 01",
      "EP 02",
      "EP 03",
      "EP 04",
      "EP 05",
      "EP 06",
    ]);
  });
});

describe("the figures", () => {
  it("count the films as the Films room does", () => {
    expect(FILM_COUNT).toBe(FILM_IDS.length);
    expect(LEDGER.find((r) => r.id === "films")?.figure).toBe(FILM_IDS.length);
  });

  it("name the films as the Films room names them", () => {
    const room = library<{ items: Array<{ id: string; title: string }> }>("video-films.json");
    const titles = room.items.filter((f) => FILM_IDS.includes(f.id as never)).map((f) => f.title);
    expect([...PHASES.flatMap((p) => p.films)].sort()).toEqual([...titles].sort());
  });

  it("count the tracks as the Music room does, on six EPs", () => {
    const room = library<{ items: unknown[] }>("music.json");
    expect(LEDGER.find((r) => r.id === "music")?.figure).toBe(room.items.length);
    expect(EP_COUNT).toBe(6);
  });

  it("are the three rooms the owner named, each a whole number with a link", () => {
    const index = library<{ counts: { voicelines: number } }>("index.json");
    expect(LEDGER.map((r) => [r.id, r.figure])).toEqual([
      ["films", 10],
      ["music", 7],
      // The count the shelf of the collection shows.
      ["voice", index.counts.voicelines],
    ]);
    expect(new Set(LEDGER.map((r) => r.href)).size).toBe(LEDGER.length);
  });

  it("lead to pages that exist", () => {
    const rooms = new Set(readdirSync(path.join(APP, "collection")));
    for (const row of LEDGER) {
      // The address may carry the way back to this page: only its path names a page.
      const parts = (row.href.split("?")[0] ?? "").split("/").filter(Boolean);
      if (parts[0] === "story") {
        expect(existsSync(path.join(APP, ...parts, "page.tsx")), row.href).toBe(true);
      } else {
        expect(parts[0]).toBe("collection");
        // A room has a folder of its own or is drawn by the `[slug]` page.
        expect(rooms.has(parts[1] ?? "") || rooms.has("[slug]"), row.href).toBe(true);
      }
    }
  });
});

describe("the words", () => {
  const all = strings([
    PHASES,
    LEDGER,
    LABEL,
    NOTICE,
    STATEMENT_LINES,
    STATEMENT_SOURCE,
    DRONE_CAPTION,
  ]);

  // Written in two halves each, so that this file is not itself a find of the text scanner.
  const BANNED = ["convic" + "tion", "source" + " code", "git" + "hub"];

  it("carry no dash character and none of the banned words", () => {
    for (const text of all) {
      expect(text, text).not.toMatch(/[‒-―]/);
      for (const word of BANNED) expect(text.toLowerCase(), text).not.toContain(word);
    }
  });

  it("make a statement of six lines", () => {
    expect(STATEMENT_LINES).toHaveLength(6);
    for (const line of STATEMENT_LINES) expect(line.length).toBeGreaterThan(0);
  });

  it("keep TheMLabel in one word, followed by the hall and skin story", () => {
    expect(LABEL.name).toBe("TheMLabel");
    expect(LABEL.parts.map((part) => part.id)).toEqual(["hall", "story"]);
  });
});

describe("the pictures", () => {
  it("are the ten splash pictures, in page order, and are on disk", () => {
    expect(ABOUT_PICTURES).toHaveLength(10);
    expect(ABOUT_PICTURES).toEqual(PHASES.flatMap((p) => p.skins.map((s) => s.picture)));
    for (const file of ABOUT_PICTURES) {
      expect(existsSync(path.join(PUBLIC, file)), file).toBe(true);
    }
  });

  it("keep the focus of every picture clear of the game mark at the top left", () => {
    // A tall window shows about two fifths of the picture's width. The mark ends an eighth of
    // the way in, so a focus of 22 percent or more keeps it out of the window.
    for (const s of PHASES.flatMap((p) => p.skins)) {
      expect(s.focus[0]).toBeGreaterThanOrEqual(22);
      expect(s.focus[0]).toBeLessThanOrEqual(70);
    }
  });
});
