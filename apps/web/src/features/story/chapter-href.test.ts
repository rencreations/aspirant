import { describe, expect, it } from "vitest";

import {
  chapterHref,
  chapterName,
  chapterShort,
  END_HREF,
  LEGACY_CHAPTER_IDS,
  LEGACY_PART_SLUGS,
  legacyChapterInfo,
  legacyPartHref,
  storyChapterHref,
} from "./chapter-href";

const CHAPTER_PAGE = /^\/story\/(prologue|chapter-\d{2})$/u;

describe("chapter links", () => {
  it("gives every chapter a page of its own", () => {
    expect(chapterHref("c00")).toBe("/story/prologue");
    expect(chapterHref("c07")).toBe("/story/chapter-07");
    expect(chapterHref("c87")).toBe("/story/chapter-87");
  });

  it("keeps a paragraph as the hash of its chapter's page", () => {
    expect(chapterHref("c12", "c12-p003")).toBe("/story/chapter-12#c12-p003");
  });

  it("names the end page", () => {
    expect(END_HREF).toBe("/story/the-end");
  });
});

describe("links from the pages written for the older story", () => {
  it("maps every old chapter id to a page of the new book", () => {
    expect(LEGACY_CHAPTER_IDS).toHaveLength(62);
    for (const id of LEGACY_CHAPTER_IDS) expect(storyChapterHref(id), id).toMatch(CHAPTER_PAGE);
  });

  it("drops the old paragraph numbers, which mean nothing in the new text", () => {
    expect(storyChapterHref("c12-p034")).toBe(storyChapterHref("c12"));
  });

  it("sends an unknown id to the Prologue", () => {
    expect(storyChapterHref("nonsense")).toBe("/story/prologue");
  });

  it("maps each of the twelve old Part pages to a chapter", () => {
    expect(LEGACY_PART_SLUGS).toHaveLength(12);
    expect(LEGACY_PART_SLUGS[0]).toBe("part-01");
    expect(LEGACY_PART_SLUGS[11]).toBe("part-12");
    for (let part = 1; part <= 12; part += 1) expect(legacyPartHref(part)).toMatch(CHAPTER_PAGE);
  });

  it("labels the chapter an old id maps to", () => {
    expect(chapterName("c05")).toMatch(/^(Prologue|Chapter \d+)$/u);
    expect(chapterShort("c05")).toMatch(/^(Prologue|Ch \d+)$/u);
    const info = legacyChapterInfo("c05");
    expect(info.label).toBe(chapterName("c05"));
    expect(info.part).toMatch(/^Act [IV]+$/u);
  });
});
