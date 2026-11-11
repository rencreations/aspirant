import { describe, expect, it } from "vitest";

import { buildIndex, countFacets, filterIndexes, searchIndexes } from "../core/flow/filter";
import type { ArtsItem } from "../core/types";
import { gameFacetOf, gameFacets, gameSearchOf } from "./facets";

function still(id: string, title: string, places: string[], tags: string[] = []): ArtsItem {
  return {
    id,
    title,
    collection: "arts",
    room: "game",
    chars: [],
    pair: null,
    canon: "official",
    tags,
    img: { t: "t", p: "p", f: "f", w: 2560, h: 1079, c: "#000000" },
    alt: `${title}.`,
    places,
  };
}

const items = [
  still("a", "Vexana faces a dark machine", ["obsidia-attack", "vexana"], ["battle"]),
  still("b", "Angela in the garden", ["angela", "the-garden"]),
  still("c", "Angela and Ruby", ["angela", "ruby"]),
];

describe("game facets", () => {
  it("are the places of a still", () => {
    expect(gameFacetOf(items[0]!)).toEqual(["obsidia-attack", "vexana"]);
  });

  it("come from the data file with the Aspirants first, in the order of the pairs", () => {
    const file = {
      v: 1 as const,
      slug: "arts-game",
      room: "game" as const,
      items,
      facets: [
        { id: "the-garden", name: "The Gardens", count: 5 },
        { id: "angela", name: "Angela", count: 2 },
        { id: "ruby", name: "Ruby", count: 1 },
        { id: "gone", name: "Gone", count: 0 },
      ],
    };
    // Ruby and Angela are a pair, in that order; the rest follow by how many pictures they hold.
    expect(gameFacets(file).map((f) => f.id)).toEqual(["ruby", "angela", "the-garden"]);
  });

  it("are counted from the stills when the file lists none", () => {
    const file = { v: 1 as const, slug: "arts-game", room: "game" as const, items };
    const facets = gameFacets(file);
    expect(facets[0]).toEqual({ id: "ruby", name: "Ruby", count: 1 });
    expect(facets[1]).toEqual({ id: "angela", name: "Angela", count: 2 });
    expect(facets.map((f) => f.name)).toContain("Obsidia Attack");
    expect(gameFacets(null)).toEqual([]);
  });

  it("filter and count together with the search", () => {
    const facets = [
      { id: "angela", name: "Angela", count: 2 },
      { id: "the-garden", name: "The Gardens", count: 1 },
    ];
    const index = buildIndex(items, gameFacetOf, gameSearchOf, facets);
    expect(filterIndexes(index, searchIndexes(index, ""), "angela")).toEqual([1, 2]);
    // The name of a place is searched, not only its id.
    expect(searchIndexes(index, "gardens")).toEqual([1]);
    expect(searchIndexes(index, "battle")).toEqual([0]);
    expect(countFacets(index, searchIndexes(index, "angela")).get("the-garden")).toBe(1);
  });
});
