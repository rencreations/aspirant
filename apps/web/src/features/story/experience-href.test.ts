import { describe, expect, it } from "vitest";

import { chapterName, chapterShort, experienceHref } from "./experience-href";

describe("experienceHref", () => {
  it("points at the chapter anchor in the reader", () => {
    expect(experienceHref("c12")).toBe("/experience/#c12");
    expect(experienceHref("i-far-above-2")).toBe("/experience/#i-far-above-2");
  });

  it("names chapters and interludes", () => {
    expect(chapterName("c05")).toBe("Chapter 5");
    expect(chapterShort("c60")).toBe("Ch 60");
    expect(chapterName("i-far-above-1")).toBe("Far Above");
  });
});
