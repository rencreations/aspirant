import { describe, expect, it } from "vitest";

import { items } from "./preload";

const ids = (list: ReturnType<typeof items>) => list.map((item) => item.id);

describe("the loading list of the Cosplay rooms", () => {
  it("waits for the data, the code, the ten splash pictures and the roster's thumbnails", () => {
    const list = items();
    const names = ids(list);
    expect(names).toContain("chunk:library-arts-cosplay");
    expect(names).toContain("library-arts-cosplay-thumbs");
    expect(names.filter((id) => id.startsWith("img:") && id.includes("/splash/"))).toHaveLength(10);
    expect(list.some((item) => item.id.endsWith("arts-cosplay.json"))).toBe(true);
  });

  it("waits for one Aspirant's art and photos on her page, and for the code of the page", () => {
    const names = ids(items("fanny"));
    expect(names).toContain("chunk:library-arts-cosplay-character");
    expect(names).toContain("library-arts-cosplay-photos-fanny");
    expect(names.filter((id) => id.includes("/splash/"))).toEqual([
      expect.stringContaining("/splash/fanny.webp"),
    ]);
  });

  it("gives an Aspirant with no photo the same list, so her page opens the same way", () => {
    expect(ids(items("ruby"))).toContain("library-arts-cosplay-photos-ruby");
  });

  it("has no id twice and defers nothing (the first screen is all there is)", () => {
    for (const list of [items(), items("layla"), items("obsidia")]) {
      const names = ids(list);
      expect(new Set(names).size).toBe(names.length);
      expect(list.some((item) => item.deferred)).toBe(false);
    }
  });

  it("loads only the data and the code for an address it does not know", () => {
    expect(ids(items("nobody"))).toHaveLength(2);
  });
});
