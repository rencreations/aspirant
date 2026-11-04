import fs from "node:fs";
import path from "node:path";

import {
  acts,
  chapterBySlug,
  chapters,
  chaptersOfAct,
  mediaList,
  nextChapter,
  previousChapter,
} from "./story";
import type { Chapter, EndFile, Media } from "./story-types";

const PUBLIC = path.resolve(__dirname, "../../public");
const STORY = path.join(PUBLIC, "data", "story");
const DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`, "u");

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(STORY, file), "utf8")) as T;
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(PUBLIC, rel));
}

function mediaOf(chapter: Chapter): Media[] {
  const out: Media[] = [chapter.hero];
  for (const block of chapter.blocks) {
    if (block.t !== "insert" || !block.media) continue;
    out.push(...mediaList(block.media));
  }
  return out;
}

describe("the story index", () => {
  it("has the Prologue and 48 chapters, in order, with one slug each", () => {
    expect(chapters).toHaveLength(49);
    expect(chapters.map((c) => c.number)).toEqual(Array.from({ length: 49 }, (_, i) => i));
    expect(chapters.map((c) => c.id)).toEqual(
      Array.from({ length: 49 }, (_, i) => `c${String(i).padStart(2, "0")}`),
    );
    expect(new Set(chapters.map((c) => c.slug)).size).toBe(49);
    expect(chapters[0]?.slug).toBe("prologue");
    expect(chapters[7]?.slug).toBe("chapter-07");
  });

  it("puts every chapter in one of the six acts", () => {
    expect(acts).toHaveLength(6);
    const counted = acts.flatMap((a) => chaptersOfAct(a).map((c) => c.id));
    expect(counted).toEqual(chapters.map((c) => c.id));
    for (const c of chapters) expect(acts.some((a) => a.roman === c.act)).toBe(true);
  });

  it("finds chapters by slug and walks from one to the next", () => {
    expect(chapterBySlug("chapter-12")?.id).toBe("c12");
    expect(previousChapter("c00")).toBeUndefined();
    expect(nextChapter("c48")).toBeUndefined();
    expect(nextChapter("c00")?.id).toBe("c01");
    expect(previousChapter("c10")?.id).toBe("c09");
  });

  it("has a card picture for every chapter, and a sealed twin where it is flagged", () => {
    for (const c of chapters) {
      expect(exists(c.thumb), c.id).toBe(true);
      if (c.sealed) expect(exists(c.sealed), c.id).toBe(true);
      expect(c.first.length, c.id).toBeGreaterThan(0);
      for (const f of c.first) {
        expect(exists(f.src), f.src).toBe(true);
        if (f.poster) expect(exists(f.poster), f.poster).toBe(true);
      }
    }
  });
});

describe("the chapter files", () => {
  it("number the paragraphs from 0 without gaps and keep the text", () => {
    for (const entry of chapters) {
      const chapter = read<Chapter>(`${entry.id}.json`);
      expect(chapter.id).toBe(entry.id);
      expect(chapter.title).toBe(entry.title);
      const numbers = chapter.blocks.flatMap((b) => (b.t === "p" ? [b.i] : []));
      expect(numbers, entry.id).toEqual(numbers.map((_, i) => i));
      expect(numbers.length, entry.id).toBe(entry.paragraphs);
      expect(numbers.length, entry.id).toBeGreaterThan(5);
    }
  });

  it("point only at files that exist, and give every picture a description", () => {
    for (const entry of chapters) {
      const chapter = read<Chapter>(`${entry.id}.json`);
      for (const m of mediaOf(chapter)) {
        expect(exists(m.src), `${entry.id} ${m.src}`).toBe(true);
        if (m.kind === "clip") expect(exists(m.poster), m.poster).toBe(true);
        expect(m.alt.trim().length, `${entry.id} ${m.src}`).toBeGreaterThan(0);
      }
      for (const b of chapter.blocks) {
        if (b.t === "p" && b.voice) expect(exists(b.voice.src), b.voice.src).toBe(true);
        if (b.t === "insert" && b.kind === "film") {
          expect(exists(b.public ?? ""), b.public).toBe(true);
          expect(exists(b.poster ?? ""), b.poster).toBe(true);
        }
      }
    }
  });

  it("carry the lines of the voice tables, and the lines of the films", () => {
    let tables = 0;
    let films = 0;
    for (const entry of chapters) {
      const chapter = read<Chapter>(`${entry.id}.json`);
      tables += chapter.blocks.filter((b) => b.t === "p" && b.voice).length;
      for (const b of chapter.blocks) {
        if (b.t !== "insert" || b.kind !== "voice") continue;
        films += 1;
        expect(b.voice, `${entry.id} voice insert`).toBeDefined();
        expect(exists(b.voice?.src ?? ""), `${entry.id} ${b.voice?.src}`).toBe(true);
        expect(b.voice?.dur ?? 0, entry.id).toBeGreaterThan(0.3);
        expect(b.voice?.dur ?? 99, entry.id).toBeLessThanOrEqual(15.5);
      }
    }
    // The 88 of the first draft, and the few the rewritten scenes use besides.
    expect(tables).toBeGreaterThanOrEqual(88);
    expect(films).toBeGreaterThan(0);
  });

  it("keep real text between the pictures of the Layla and Fanny arc, and no video under 3 seconds", () => {
    const ARC = ["c00", "c01", "c02", "c03", "c04", "c05", "c08"];
    for (const id of ARC) {
      const chapter = read<Chapter>(`${id}.json`);
      if (chapter.hero.kind === "clip")
        expect(chapter.hero.dur, `${id} hero`).toBeGreaterThanOrEqual(3);
      let words = 0;
      let sawPicture = false;
      for (const b of chapter.blocks) {
        if (b.t === "p") {
          words += b.segs
            .map((seg) => seg.t)
            .join("")
            .split(/\s+/u)
            .filter(Boolean).length;
        } else if (b.t === "insert" && b.kind !== "voice") {
          expect(words, `${id}: text before a picture (${b.kind})`).toBeGreaterThanOrEqual(45);
          words = 0;
          sawPicture = true;
          for (const m of mediaList(b.media)) {
            if (m.kind === "clip") expect(m.dur, `${id} clip`).toBeGreaterThanOrEqual(3);
          }
        }
      }
      if (sawPicture)
        expect(words, `${id}: text after the last picture`).toBeGreaterThanOrEqual(45);
    }
  });

  it("have no em or en dash anywhere", () => {
    for (const file of fs.readdirSync(STORY)) {
      expect(fs.readFileSync(path.join(STORY, file), "utf8"), file).not.toMatch(DASHES);
    }
  });
});

describe("the end page data", () => {
  it("lists the ten, the others and the timeline", () => {
    const end = read<EndFile>("end.json");
    expect(end.cast.map((c) => c.slug)).toEqual([
      "layla",
      "fanny",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "selena",
      "obsidia",
    ]);
    expect(end.also.length).toBeGreaterThan(0);
    expect(end.timeline.length).toBeGreaterThan(4);
    expect(end.timeline[0]?.when).toMatch(/978/u);
  });
});
