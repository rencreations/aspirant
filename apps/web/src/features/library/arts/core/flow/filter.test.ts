import { describe, expect, it } from "vitest";

import {
  buildIndex,
  chipsFor,
  countFacets,
  filterIndexes,
  liveFacets,
  normalise,
  queryTerms,
  searchIndexes,
  splitFacets,
} from "./filter";

interface Pic {
  title: string;
  places: string[];
}

const PICS: Pic[] = [
  { title: "Chang'e at the lake", places: ["change", "lake"] },
  { title: "Angela and Ruby", places: ["angela", "ruby"] },
  { title: "Oro soldiers march", places: ["oro-soldier"] },
  { title: "Angela, training", places: ["angela"] },
  { title: "Quiet street", places: [] },
];

const index = buildIndex(
  PICS,
  (p) => p.places,
  (p) => `${p.title} ${p.places.join(" ")}`,
);

describe("normalise", () => {
  it("folds case, accents, apostrophes and punctuation", () => {
    expect(normalise("Chang'e")).toBe("change");
    expect(normalise("Chang’e")).toBe("change");
    expect(normalise("  Sélrick   Academy! ")).toBe("selrick academy");
    expect(normalise("oro-soldier")).toBe("oro soldier");
  });

  it("keeps Japanese text", () => {
    expect(normalise("アンジェラ")).toContain("アンジェラ");
  });
});

describe("search", () => {
  it("matches everything for an empty query", () => {
    expect(searchIndexes(index, "")).toEqual([0, 1, 2, 3, 4]);
    expect(searchIndexes(index, "   ")).toEqual([0, 1, 2, 3, 4]);
  });

  it("finds Chang'e by change and by chang'e", () => {
    expect(searchIndexes(index, "change")).toEqual([0]);
    expect(searchIndexes(index, "Chang'e")).toEqual([0]);
  });

  it("needs every word", () => {
    expect(searchIndexes(index, "angela ruby")).toEqual([1]);
    expect(searchIndexes(index, "angela")).toEqual([1, 3]);
    expect(searchIndexes(index, "angela lake")).toEqual([]);
  });

  it("matches a part of a word", () => {
    expect(searchIndexes(index, "sold")).toEqual([2]);
    expect(queryTerms("Oro-soldier")).toEqual(["oro", "soldier"]);
  });
});

describe("filter", () => {
  it("keeps the items of one facet, among the ones given", () => {
    const all = searchIndexes(index, "");
    expect(filterIndexes(index, all, "angela")).toEqual([1, 3]);
    expect(filterIndexes(index, searchIndexes(index, "ruby"), "angela")).toEqual([1]);
    expect(filterIndexes(index, all, "")).toEqual(all);
    expect(filterIndexes(index, all, "nobody")).toEqual([]);
  });
});

describe("counts", () => {
  it("count the facets of the items that match the search", () => {
    const all = countFacets(index, searchIndexes(index, ""));
    expect(all.get("angela")).toBe(2);
    expect(all.get("ruby")).toBe(1);
    const some = countFacets(index, searchIndexes(index, "ruby"));
    expect(some.get("angela")).toBe(1);
    expect(some.get("change")).toBeUndefined();
  });

  it("count an item once for a facet it lists twice", () => {
    const twice = buildIndex(
      [{ places: ["a", "a"] }],
      (p) => p.places,
      () => "x",
    );
    expect(countFacets(twice, [0]).get("a")).toBe(1);
  });
});

describe("liveFacets", () => {
  const facets = [
    { id: "angela", name: "Angela", count: 2 },
    { id: "change", name: "Chang'e", count: 1 },
    { id: "ruby", name: "Ruby", count: 1 },
  ];

  it("keeps the room's order and every facet when nothing is searched", () => {
    const live = liveFacets(facets, countFacets(index, searchIndexes(index, "")), false, "");
    expect(live.map((f) => f.id)).toEqual(["angela", "change", "ruby"]);
    expect(live.map((f) => f.live)).toEqual([2, 1, 1]);
  });

  it("leaves out the facets with no match while searching, but keeps the chosen one", () => {
    const counts = countFacets(index, searchIndexes(index, "ruby"));
    expect(liveFacets(facets, counts, true, "").map((f) => f.id)).toEqual(["angela", "ruby"]);
    expect(liveFacets(facets, counts, true, "change").map((f) => f.id)).toEqual([
      "angela",
      "change",
      "ruby",
    ]);
  });
});

describe("splitFacets", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `f${i}`,
    name: `F${i}`,
    count: 20 - i,
    live: 20 - i,
  }));

  it("shows the first ones and puts the rest behind See more", () => {
    const { chips, more } = splitFacets(many, 6, "");
    expect(chips.map((f) => f.id)).toEqual(["f0", "f1", "f2", "f3", "f4", "f5"]);
    expect(more).toHaveLength(6);
  });

  it("always shows the chosen facet", () => {
    const { chips, more } = splitFacets(many, 6, "f9");
    expect(chips.map((f) => f.id)).toContain("f9");
    expect(chips).toHaveLength(6);
    expect(more.map((f) => f.id)).not.toContain("f9");
    expect(more.map((f) => f.id)).toContain("f5");
    expect(chips.length + more.length).toBe(12);
  });

  it("has no rest when everything fits", () => {
    expect(splitFacets(many.slice(0, 3), 6, "").more).toEqual([]);
  });
});

describe("chipsFor", () => {
  it("shows 6 to 8 chips, more on a wider page", () => {
    expect(chipsFor(1440)).toBe(8);
    expect(chipsFor(1100)).toBe(7);
    expect(chipsFor(820)).toBe(6);
    expect(chipsFor(390)).toBe(6);
  });
});
