import { describe, expect, it } from "vitest";

import { characterSlugs } from "@/content/characters";

import { buildIndex, countFacets, filterIndexes, searchIndexes } from "../core/flow/filter";
import {
  ASPIRANT_NAMES,
  othersFacetOf,
  othersFacets,
  othersSearchOf,
  type OthersItem,
} from "./facets";

function pic(id: string, kind: string, chars: OthersItem["chars"], by?: string): OthersItem {
  return {
    id,
    title: `Picture ${id}`,
    collection: "arts",
    room: "others",
    chars,
    pair: null,
    canon: by ? "fan" : "official",
    tags: [],
    img: { t: "t", p: "p", f: "f", w: 1000, h: 1000, c: "#000000" },
    alt: `Picture ${id}.`,
    places: [],
    kind,
    ...(by ? { credit: { by, platform: "Instagram", url: null } } : {}),
  };
}

const items = [
  pic("a", "chibi", ["selena"]),
  pic("b", "chibi", ["obsidia", "selena"]),
  pic("c", "poster", ["change"], "Made for this site"),
  pic("d", "lore", []),
];

const file = {
  v: 1 as const,
  slug: "arts-others",
  room: "others" as const,
  items,
  kinds: [
    { id: "lore", name: "Lore cards", count: 1 },
    { id: "chibi", name: "Chibi", count: 2 },
    { id: "poster", name: "Posters", count: 1 },
  ],
  characters: [
    { slug: "selena", count: 2 },
    { slug: "change", count: 1 },
    { slug: "obsidia", count: 1 },
  ],
};

describe("others facets", () => {
  it("name every Aspirant as canon spells them", () => {
    expect(Object.keys(ASPIRANT_NAMES).sort()).toEqual([...characterSlugs].sort());
    expect(ASPIRANT_NAMES.change).toBe("Chang'e");
  });

  it("are the picture's kind and each Aspirant in it, with a prefix", () => {
    expect(othersFacetOf(items[1]!)).toEqual(["kind:chibi", "char:obsidia", "char:selena"]);
    expect(othersFacetOf(items[3]!)).toEqual(["kind:lore"]);
  });

  it("list the kinds first, then the Aspirants, each by its count", () => {
    const facets = othersFacets(file);
    expect(facets.map((f) => f.id)).toEqual([
      "kind:chibi",
      "kind:lore",
      "kind:poster",
      "char:selena",
      "char:change",
      "char:obsidia",
    ]);
    expect(facets.find((f) => f.id === "char:change")?.name).toBe("Chang'e");
  });

  it("are counted from the pictures when the file lists none", () => {
    const bare = { v: 1 as const, slug: "arts-others", room: "others" as const, items };
    const facets = othersFacets(bare);
    expect(facets[0]).toEqual({ id: "kind:chibi", name: "Chibi", count: 2 });
    expect(facets.find((f) => f.id === "kind:poster")?.name).toBe("Posters");
    expect(facets.find((f) => f.id === "char:selena")?.count).toBe(2);
    expect(othersFacets(null)).toEqual([]);
  });

  it("filter, count and search together", () => {
    const facets = othersFacets(file);
    const index = buildIndex(items, othersFacetOf, othersSearchOf, facets);
    const all = searchIndexes(index, "");
    expect(filterIndexes(index, all, "kind:chibi")).toEqual([0, 1]);
    expect(filterIndexes(index, all, "char:selena")).toEqual([0, 1]);
    // The kind, the credit and the Aspirant's name are all searched.
    expect(searchIndexes(index, "poster")).toEqual([2]);
    expect(searchIndexes(index, "instagram")).toEqual([2]);
    expect(searchIndexes(index, "chang'e")).toEqual([2]);
    expect(countFacets(index, searchIndexes(index, "chibi")).get("char:obsidia")).toBe(1);
  });
});
