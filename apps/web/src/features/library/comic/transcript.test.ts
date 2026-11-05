import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parsePage } from "./progress";
import {
  blocksForPage,
  groupLines,
  listNumbers,
  rangeLabel,
  sequenceOf,
  transcriptSpan,
} from "./transcript";
import type { ComicFile, TranscriptBlock } from "./types";

const file = path.resolve(import.meta.dirname, "../../../../public/data/library/comic.json");
const data = JSON.parse(readFileSync(file, "utf8")) as ComicFile;
const official = data.items.filter((c) => c.kind === "official");
const fan = data.items.filter((c) => c.kind === "fan");

const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

describe("blocksForPage", () => {
  const blocks: TranscriptBlock[] = [
    { from: 1, to: 1, lines: [{ k: "say", t: "a" }] },
    { from: 2, to: 4, lines: [{ k: "scene", t: "b" }] },
    { from: 4, to: 4, lines: [{ k: "say", t: "c" }] },
  ];

  it("finds the block whose range holds the page", () => {
    expect(blocksForPage(blocks, 1).map((b) => b.index)).toEqual([0]);
    expect(blocksForPage(blocks, 3).map((b) => b.index)).toEqual([1]);
  });

  it("returns every block when the source overlaps on a page", () => {
    expect(blocksForPage(blocks, 4).map((b) => b.index)).toEqual([1, 2]);
  });

  it("returns nothing for a page without text, or when there is no transcript", () => {
    expect(blocksForPage(blocks, 9)).toEqual([]);
    expect(blocksForPage(undefined, 1)).toEqual([]);
  });
});

describe("helpers", () => {
  it("labels page ranges and lists of numbers", () => {
    expect(rangeLabel(4, 4)).toBe("Page 4");
    expect(rangeLabel(5, 10)).toBe("Pages 5 to 10");
    expect(listNumbers([3])).toBe("3");
    expect(listNumbers([3, 23, 40])).toBe("3, 23 and 40");
  });

  it("reads a saved page number safely", () => {
    expect(parsePage("12")).toBe(12);
    expect(parsePage("0")).toBeNull();
    expect(parsePage("x")).toBeNull();
    expect(parsePage(null)).toBeNull();
  });

  it("groups one speaker's lines", () => {
    const groups = groupLines([
      { k: "say", who: "Fanny", t: "one" },
      { k: "say", who: "Fanny", t: "two" },
      { k: "scene", t: "three" },
      { k: "say", who: "Layla", t: "four" },
    ]);
    expect(groups.map((g) => g.lines.length)).toEqual([2, 1, 1]);
  });

  it("finds the span of a transcript", () => {
    expect(transcriptSpan(undefined)).toBeNull();
    expect(
      transcriptSpan([
        { from: 2, to: 4, lines: [] },
        { from: 8, to: 9, lines: [] },
      ]),
    ).toEqual({ from: 2, to: 9 });
  });
});

describe("comic.json", () => {
  it("has two official comics first, then the fan comics", () => {
    expect(official.map((c) => c.id)).toEqual(["comic-the-aspirant", "comic-guinevere-vexana"]);
    expect(data.items.slice(0, 2)).toEqual(official);
    expect(fan.length).toBeGreaterThanOrEqual(20);
  });

  it("has the pages of the official comics and names the missing ones", () => {
    const [aspirant, guinevere] = official;
    expect(aspirant?.pages).toHaveLength(42);
    expect(aspirant?.missing).toEqual([]);
    expect(guinevere?.pages).toHaveLength(43);
    expect(guinevere?.missing).toEqual([3, 23, 40]);
    expect(guinevere?.total).toBe(46);
  });

  it("puts a gap in the reading order for every missing page", () => {
    const guinevere = official[1];
    expect(guinevere).toBeDefined();
    if (!guinevere) return;
    const seq = sequenceOf(guinevere);
    expect(seq).toHaveLength(46);
    expect(seq.filter((e) => e.kind === "missing").map((e) => e.n)).toEqual([3, 23, 40]);
    expect(seq.map((e) => e.n)).toEqual(Array.from({ length: 46 }, (_, i) => i + 1));
  });

  it("maps every transcript block to pages that exist, never to a missing page", () => {
    for (const comic of official) {
      const have = new Set(comic.pages.map((p) => p.n));
      for (const block of comic.transcript ?? []) {
        expect(block.from).toBeLessThanOrEqual(block.to);
        expect(block.lines.length).toBeGreaterThan(0);
        // The first and last page of a block are real pages (a range may step over a gap).
        expect(have.has(block.from)).toBe(true);
        expect(have.has(block.to)).toBe(true);
        for (const m of comic.missing) {
          expect(m >= block.from && m <= block.to).toBe(false);
        }
      }
    }
  });

  it("agrees with blocksForPage on the page records", () => {
    for (const comic of official) {
      for (const page of comic.pages) {
        const found = blocksForPage(comic.transcript, page.n).map((b) => b.index);
        expect(page.x ?? []).toEqual(found);
      }
    }
  });

  it("covers the pages the source has text for, and the overlap is only the one known page", () => {
    const [aspirant, guinevere] = official;
    expect(transcriptSpan(aspirant?.transcript)).toEqual({ from: 1, to: 42 });
    expect(transcriptSpan(guinevere?.transcript)).toEqual({ from: 2, to: 45 });
    const overlapped: number[] = [];
    for (const comic of official) {
      for (const page of comic.pages) {
        if ((page.x?.length ?? 0) > 1) overlapped.push(page.n);
      }
    }
    expect(overlapped).toEqual([21]);
  });

  it("keeps the slices of a tall page whole: they add up to the page", () => {
    for (const comic of data.items) {
      for (const page of comic.pages) {
        if (!page.s) continue;
        expect(page.s.reduce((sum, s) => sum + s.h, 0)).toBe(page.h);
        expect(page.s.length).toBeGreaterThan(1);
      }
    }
  });

  it("orders pages and gives every fan comic a credit and the fan label", () => {
    for (const comic of data.items) {
      const ns = comic.pages.map((p) => p.n);
      expect(ns).toEqual([...ns].sort((a, b) => a - b));
      expect(new Set(ns).size).toBe(ns.length);
    }
    for (const comic of fan) {
      expect(comic.canon).toBe("fan");
      expect(comic.credit?.by).toBeTruthy();
      expect(comic.credit?.url).toMatch(/^https:\/\/www\.instagram\.com\/p\//);
      expect(comic.pages.length).toBeGreaterThan(0);
    }
    for (const comic of official) expect(comic.canon).toBe("official");
  });

  it("has unique ids, no dashes and no excluded post", () => {
    const ids = data.items.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DASH.test(readFileSync(file, "utf8"))).toBe(false);
    expect(ids.some((id) => id.includes("czj3yserrju") || id.includes("czj3yserjru"))).toBe(false);
  });
});
