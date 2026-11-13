import { describe, expect, it } from "vitest";

import { comicPath, comicSlugFromPath } from "./route";

describe("the address of a comic", () => {
  it("makes the address of a comic or of the room", () => {
    expect(comicPath("the-aspirant")).toBe("/collection/comic/the-aspirant/");
    expect(comicPath()).toBe("/collection/comic/");
  });

  it("reads the slug back, and nothing for the room or another page", () => {
    expect(comicSlugFromPath("/collection/comic/art-class/")).toBe("art-class");
    expect(comicSlugFromPath("/collection/comic/art-class")).toBe("art-class");
    expect(comicSlugFromPath("/collection/comic/")).toBe("");
    expect(comicSlugFromPath("/collection/lore/a/")).toBe("");
    expect(comicSlugFromPath("/collection/comic/a/b/")).toBe("");
  });
});
