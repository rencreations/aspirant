import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHARACTER_NAMES, CHARACTER_SLUGS } from "@/lib/slugs";

import {
  NO_COSPLAY,
  PEOPLE_LINE,
  ROSTER_ORDER,
  cosplaySearchOf,
  countDigits,
  countWords,
  dateWords,
  firstCharacterOf,
  neighbour,
  photosOf,
  rosterOf,
  thumbsOf,
  totalsOf,
  type CosplayFile,
  type CosplayItem,
} from "./model";

const FILE = path.resolve(__dirname, "../../../../../public/data/library/arts-cosplay.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8")) as CosplayFile;

/** An en dash or an em dash, built from escapes so this file holds none. */
const DASHES = new RegExp("[\u2013\u2014]", "u");

const img = { t: "t", p: "p", f: "f", w: 1080, h: 1080, c: "#445566" };

function photo(id: string, chars: CosplayItem["chars"]): CosplayItem {
  return {
    id,
    title: id,
    collection: "arts",
    room: "cosplay",
    chars,
    pair: "fanny-layla",
    canon: "fan",
    tags: ["cosplay"],
    img,
    alt: "A cosplayer.",
    places: [...chars],
  };
}

describe("the roster order", () => {
  it("holds the ten Aspirants once each", () => {
    expect([...ROSTER_ORDER].sort()).toEqual([...CHARACTER_SLUGS].sort());
  });

  it("is the order of the data file, in pairs", () => {
    expect(data.characters.map((c) => c.slug)).toEqual([...ROSTER_ORDER]);
    for (let i = 0; i < ROSTER_ORDER.length; i += 2) {
      expect(data.characters[i]?.pair).toBe(data.characters[i + 1]?.pair);
    }
  });

  it("names them as the site spells them", () => {
    for (const c of data.characters) expect(c.name).toBe(CHARACTER_NAMES[c.slug]);
  });
});

describe("the data file", () => {
  it("counts every photo under each Aspirant it shows", () => {
    for (const c of data.characters) expect(photosOf(data.items, c.slug).length).toBe(c.count);
  });

  it("holds an Aspirant with no photo, for all ten pages", () => {
    const empty = data.characters.filter((c) => c.count === 0);
    expect(empty.length).toBeGreaterThan(0);
    expect(data.characters).toHaveLength(10);
  });

  it("credits every photo to a named person with a link to the post", () => {
    for (const item of data.items) {
      expect(item.credit?.by, item.id).toBeTruthy();
      expect(item.credit?.url, item.id).toMatch(/^https:\/\//u);
      expect(item.canon).toBe("fan");
    }
  });

  it("has no dash in any shipped word", () => {
    const words = JSON.stringify(data.items.map((i) => [i.title, i.alt, i.credit]));
    expect(words).not.toMatch(DASHES);
  });
});

describe("photosOf and rosterOf", () => {
  const items = [
    photo("a", ["fanny", "layla"]),
    photo("b", ["layla"]),
    photo("c", ["fanny"]),
    photo("d", ["fanny"]),
  ];

  it("lists a duo photo under both Aspirants, after her own photos", () => {
    expect(photosOf(items, "fanny").map((i) => i.id)).toEqual(["c", "d", "a"]);
    expect(photosOf(items, "layla").map((i) => i.id)).toEqual(["b", "a"]);
    expect(photosOf(items, "ruby")).toEqual([]);
  });

  it("opens a pair on different pictures", () => {
    const fanny = photosOf(data.items, "fanny")[0];
    const layla = photosOf(data.items, "layla")[0];
    expect(fanny?.id).not.toBe(layla?.id);
    expect(fanny?.chars).toEqual(["fanny"]);
    expect(layla?.chars).toEqual(["layla"]);
  });

  it("gives all ten, with a zero for each Aspirant with no photo", () => {
    const roster = rosterOf(items);
    expect(roster).toHaveLength(10);
    expect(roster.find((r) => r.slug === "fanny")?.count).toBe(3);
    expect(roster.find((r) => r.slug === "selena")?.count).toBe(0);
  });

  it("gives null counts before the data has arrived", () => {
    expect(rosterOf(null).every((r) => r.count === null)).toBe(true);
    expect(rosterOf(null).map((r) => r.slug)).toEqual([...ROSTER_ORDER]);
  });

  it("totals the photos and the Aspirants that hold one", () => {
    expect(totalsOf(items)).toEqual({ photos: 4, withPhotos: 2 });
  });

  it("opens a duo photo under its first Aspirant in the roster order", () => {
    expect(firstCharacterOf(photo("x", ["layla", "fanny"]))).toBe("fanny");
    expect(firstCharacterOf(photo("y", ["obsidia", "selena"]))).toBe("selena");
  });
});

describe("neighbour", () => {
  it("goes round the ten, both ways", () => {
    expect(neighbour("fanny", 1)).toBe("layla");
    expect(neighbour("fanny", -1)).toBe("obsidia");
    expect(neighbour("obsidia", 1)).toBe("fanny");
    expect(neighbour("selena", 1)).toBe("obsidia");
  });
});

describe("thumbsOf", () => {
  it("shows every photo up to the limit", () => {
    expect(thumbsOf([1, 2, 3], 4)).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(thumbsOf([1, 2, 3, 4], 4)).toEqual({ shown: [1, 2, 3, 4], more: 0 });
    expect(thumbsOf([], 4)).toEqual({ shown: [], more: 0 });
  });

  it("gives the last cell to a counter when there are more", () => {
    expect(thumbsOf([1, 2, 3, 4, 5, 6, 7, 8], 4)).toEqual({ shown: [1, 2, 3], more: 5 });
  });
});

describe("the words", () => {
  it("says the count plainly", () => {
    expect(countWords(null)).toBe("");
    expect(countWords(0)).toBe("No cosplay yet");
    expect(countWords(1)).toBe("1 photo");
    expect(countWords(8)).toBe("8 photos");
    expect(countDigits(8)).toBe("08");
    expect(countDigits(12)).toBe("12");
  });

  it("writes a date out", () => {
    expect(dateWords("2022-01-14")).toBe("14 Jan 2022");
    expect(dateWords("2022-12-03")).toBe("3 Dec 2022");
    expect(dateWords(undefined)).toBe("");
    expect(dateWords("soon")).toBe("soon");
  });

  it("has no dash and ends its sentences", () => {
    for (const text of [NO_COSPLAY, PEOPLE_LINE]) {
      expect(text).not.toMatch(DASHES);
      expect(text.endsWith(".")).toBe(true);
    }
  });

  it("finds a photo by who made it and who it shows", () => {
    const item = {
      ...photo("a", ["fanny", "layla"]),
      credit: { by: "Jo", platform: null, url: null },
    };
    const text = cosplaySearchOf(item).toLowerCase();
    expect(text).toContain("jo");
    expect(text).toContain("fanny");
    expect(text).toContain("layla");
  });
});
