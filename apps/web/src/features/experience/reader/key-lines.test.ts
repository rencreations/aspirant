import { HELD_BEATS, KEY_LINES } from "./key-lines";
import { plainText } from "./rich-text";
import { blocksById, readIndex } from "./story-fixture";

const blocks = blocksById();
const index = readIndex();
const order = new Map(index.chapters.map((chapter, i) => [chapter.id as string, i]));
const DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`, "u");

function textOf(id: string): string {
  const block = blocks.get(id)?.block;
  return block?.type === "p" ? plainText(block.segments) : "";
}

describe("key lines", () => {
  it("names real paragraphs, once each", () => {
    const ids = KEY_LINES.map((line) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const line of KEY_LINES) {
      const hit = blocks.get(line.id);
      expect(hit, line.id).toBeDefined();
      expect(hit?.block.type, line.id).toBe("p");
    }
  });

  it("keeps every emphasis and excerpt word for word", () => {
    for (const line of KEY_LINES) {
      const text = textOf(line.id);
      for (const phrase of line.emphasis ?? []) expect(text, line.id).toContain(phrase);
      if (line.excerpt) expect(text, line.id).toContain(line.excerpt);
      if (line.excerpt && line.emphasis) {
        for (const phrase of line.emphasis) expect(line.excerpt, line.id).toContain(phrase);
      }
    }
  });

  it("is short enough to set large (or breaks out one sentence)", () => {
    for (const line of KEY_LINES) {
      const words = (line.excerpt ?? textOf(line.id)).split(/\s+/u).filter(Boolean).length;
      expect(words, line.id).toBeLessThanOrEqual(20);
    }
  });

  it("gives every chapter and interlude one to three, in book order", () => {
    const perUnit = new Map<string, number>();
    let last = -1;
    for (const line of KEY_LINES) {
      const chapterId = blocks.get(line.id)?.chapterId ?? "";
      perUnit.set(chapterId, (perUnit.get(chapterId) ?? 0) + 1);
      const at = order.get(chapterId) ?? -1;
      expect(at, line.id).toBeGreaterThanOrEqual(last);
      last = at;
    }
    for (const chapter of index.chapters) {
      const n = perUnit.get(chapter.id) ?? 0;
      expect(n, chapter.id).toBeGreaterThanOrEqual(1);
      expect(n, chapter.id).toBeLessThanOrEqual(3);
    }
  });
});

describe("held beats", () => {
  it("has one per Part, quoted exactly from that Part", () => {
    expect(HELD_BEATS.map((beat) => beat.part)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    for (const beat of HELD_BEATS) {
      expect(beat.text).not.toMatch(DASHES);
      if (beat.from === null) {
        expect(beat.text).toBe("The lamp is on.");
        continue;
      }
      expect(blocks.get(beat.from)?.part, beat.from).toBe(beat.part);
      expect(textOf(beat.from), beat.from).toContain(beat.text);
    }
  });
});
