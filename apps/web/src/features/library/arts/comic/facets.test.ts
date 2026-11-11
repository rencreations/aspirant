import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildIndex,
  countFacets,
  filterIndexes,
  liveFacets,
  searchIndexes,
  splitFacets,
} from "../core/flow/filter";
import type { ArtsFile } from "../core/types";
import { comicFacetOf, comicFacets, comicSearchOf, pageLabel, placeLabel } from "./facets";
import type { ComicHead, ComicItem } from "./types";

function panel(
  id: string,
  comic: ComicItem["comic"],
  page: number,
  panelNo: number | null,
  chars: ComicItem["chars"],
  title = id,
): ComicItem {
  return {
    id,
    title,
    collection: "arts",
    room: "comic",
    chars,
    pair: null,
    canon: "official",
    tags: [],
    img: { t: "t", p: "p", f: "f", w: 1000, h: 2000, c: "#000000" },
    alt: `${title}.`,
    places: [],
    comic,
    page,
    panel: panelNo,
    shape: "tall",
    ratio: 0.5,
    alpha: false,
  };
}

const items = [
  panel("a", "the-aspirant", 3, 1, ["fanny"], "Fanny slashes a droid"),
  panel("b", "the-aspirant", 12, null, ["layla", "fanny"], "Layla boasts"),
  panel("c", "guinevere-vexana", 4, 2, ["vexana"], "Vexana kneels"),
  panel("d", "guinevere-vexana", 5, 1, ["guinevere", "vexana"], "Two on a hill"),
];

describe("comic facets", () => {
  it("hold the comic and the Aspirants of a panel", () => {
    expect(comicFacetOf(items[1]!)).toEqual(["the-aspirant", "layla", "fanny"]);
  });

  it("are counted from the panels, the most first, with the comics' own names", () => {
    const file = { v: 1, slug: "arts-comic", room: "comic", items } as ArtsFile<ComicItem>;
    const facets = comicFacets(file);
    expect(facets.map((f) => f.id).sort()).toEqual(
      ["fanny", "guinevere", "guinevere-vexana", "layla", "the-aspirant", "vexana"].sort(),
    );
    // The most panels first, then by name.
    expect(facets.map((f) => f.count)).toEqual([2, 2, 2, 2, 1, 1]);
    expect(facets.map((f) => f.name).slice(0, 4)).toEqual([
      "Fanny",
      "Guinevere and Vexana",
      "The Aspirant",
      "Vexana",
    ]);
    expect(facets.find((f) => f.id === "the-aspirant")).toEqual({
      id: "the-aspirant",
      name: "The Aspirant",
      count: 2,
    });
    expect(facets.find((f) => f.id === "guinevere-vexana")?.name).toBe("Guinevere and Vexana");
    expect(facets.find((f) => f.id === "vexana")).toEqual({
      id: "vexana",
      name: "Vexana",
      count: 2,
    });
  });

  it("take a comic's name from the head of the file when it has one", () => {
    const file = {
      v: 1,
      slug: "arts-comic",
      room: "comic",
      items,
      comics: [{ id: "the-aspirant", name: "The Aspirant webtoon", count: 2 }],
    } as ArtsFile<ComicItem> & ComicHead;
    expect(comicFacets(file).find((f) => f.id === "the-aspirant")?.name).toBe(
      "The Aspirant webtoon",
    );
  });

  it("are empty before the data has arrived", () => {
    expect(comicFacets(null)).toEqual([]);
  });
});

describe("comic labels", () => {
  it("say the page, and the panel when the sources give it", () => {
    expect(pageLabel({ page: 12, panel: 2 })).toBe("Page 12, panel 2");
    expect(pageLabel({ page: 12, panel: null })).toBe("Page 12");
    expect(placeLabel({ comic: "the-aspirant", page: 12, panel: 2 })).toBe(
      "The Aspirant, page 12, panel 2",
    );
    expect(placeLabel({ comic: "guinevere-vexana", page: 4, panel: null })).toBe(
      "Guinevere and Vexana, page 4",
    );
  });
});

describe("comic search and filter", () => {
  const facets = comicFacets({
    v: 1,
    slug: "arts-comic",
    room: "comic",
    items,
  });
  const index = buildIndex(items, comicFacetOf, comicSearchOf, facets);
  const ids = (at: number[]) => at.map((i) => items[i]?.id);

  it("finds a panel by its title, its Aspirant, its comic and its page", () => {
    expect(ids(searchIndexes(index, "droid"))).toEqual(["a"]);
    expect(ids(searchIndexes(index, "guinevere"))).toEqual(["c", "d"]);
    expect(ids(searchIndexes(index, "the aspirant"))).toEqual(["a", "b"]);
    expect(ids(searchIndexes(index, "page 12"))).toEqual(["b"]);
    expect(ids(searchIndexes(index, "panel 2"))).toEqual(["c"]);
  });

  it("filters by a comic or by an Aspirant, never an empty mix", () => {
    const all = searchIndexes(index, "");
    expect(ids(filterIndexes(index, all, "guinevere-vexana"))).toEqual(["c", "d"]);
    expect(ids(filterIndexes(index, all, "fanny"))).toEqual(["a", "b"]);
    for (const facet of facets) {
      expect(filterIndexes(index, all, facet.id).length).toBe(facet.count);
    }
  });

  it("keeps every chip on the page and the chosen one first among the rest", () => {
    const all = searchIndexes(index, "");
    const live = liveFacets(facets, countFacets(index, all), false, "");
    const { chips, more } = splitFacets(live, 8, "");
    expect(chips).toHaveLength(facets.length);
    expect(more).toHaveLength(0);
  });
});

// The real file ---------------------------------------------------------------------------

const file = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/data/library/arts-comic.json"),
    "utf8",
  ),
) as ArtsFile<ComicItem> & ComicHead;

describe("the 114 panels of the file", () => {
  const facets = comicFacets(file);

  it("have six chips whose counts agree with the head of the file", () => {
    expect(facets).toHaveLength(6);
    for (const comic of file.comics) {
      expect(facets.find((f) => f.id === comic.id)?.count).toBe(comic.count);
    }
  });

  it("put every Aspirant in one comic only, so no chip can be combined into an empty page", () => {
    const comicsOf = new Map<string, Set<string>>();
    for (const item of file.items) {
      for (const who of item.chars) {
        (comicsOf.get(who) ?? comicsOf.set(who, new Set()).get(who))?.add(item.comic);
      }
    }
    for (const [, comics] of comicsOf) expect(comics.size).toBe(1);
  });

  it("have a place label for every panel", () => {
    for (const item of file.items) expect(placeLabel(item)).toMatch(/, page \d+/);
  });
});
