import { describe, expect, it } from "vitest";

import { chapters } from "@/content/story";

import { COLLAPSED_ROWS, orderUnits, readingMinutes, visibleUnits } from "./chapter-list";

describe("chapter list", () => {
  it("starts from chapter 1 or from the latest chapter", () => {
    expect(orderUnits(chapters, "first")[0]?.id).toBe("c01");
    expect(orderUnits(chapters, "latest")[0]?.id).toBe(chapters.at(-1)?.id);
    expect(orderUnits(chapters, "latest")).toHaveLength(chapters.length);
  });

  it("does not change the list it is given", () => {
    const before = chapters.map((c) => c.id).join();
    orderUnits(chapters, "latest");
    expect(chapters.map((c) => c.id).join()).toBe(before);
  });

  it("shows only some rows until the list is opened", () => {
    expect(visibleUnits(chapters, false)).toHaveLength(COLLAPSED_ROWS);
    expect(visibleUnits(chapters, true)).toHaveLength(chapters.length);
    expect(visibleUnits(chapters.slice(0, 3), false)).toHaveLength(3);
  });

  it("rounds the reading time and never says zero", () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(1150)).toBe(5);
  });
});
