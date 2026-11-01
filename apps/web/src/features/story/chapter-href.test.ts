import { describe, expect, it } from "vitest";

import { chapterName, chapterShort, partHref, partSlug, storyChapterHref } from "./chapter-href";

describe("chapter links", () => {
  it("puts a chapter on the page of its Part", () => {
    expect(storyChapterHref("c01")).toBe("/story/part-01/#c01");
    expect(storyChapterHref("c12")).toBe("/story/part-03/#c12");
    expect(storyChapterHref("c60")).toBe("/story/part-12/#c60");
    expect(storyChapterHref("i-far-above-2")).toMatch(/^\/story\/part-\d{2}\/#i-far-above-2$/u);
  });

  it("keeps a paragraph on the page of its chapter", () => {
    expect(storyChapterHref("c12-p034")).toBe("/story/part-03/#c12-p034");
  });

  it("names the pages of the Parts", () => {
    expect(partSlug(7)).toBe("part-07");
    expect(partHref(12)).toBe("/story/part-12");
  });

  it("names chapters and interludes", () => {
    expect(chapterName("c05")).toBe("Chapter 5");
    expect(chapterShort("c60")).toBe("Ch 60");
    expect(chapterName("i-far-above-1")).toBe("Far Above");
  });
});
