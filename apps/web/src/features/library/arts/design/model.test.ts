import { describe, expect, it } from "vitest";

import {
  aspirantName,
  buildDesignIndex,
  firstShown,
  formatDate,
  isWideWriting,
  kindFacets,
  kindName,
  kindOne,
  resolveQuery,
  sheetNumber,
  viewOf,
  whoFacets,
} from "./model";
import type { DesignFile, DesignItem } from "./types";

function item(
  id: string,
  what: string,
  chars: string[],
  extra: Partial<DesignItem> & { w?: number; h?: number } = {},
): DesignItem {
  const { w = 1000, h = 800, ...rest } = extra;
  return {
    id,
    title: id,
    collection: "arts",
    room: "design",
    chars: chars as DesignItem["chars"],
    pair: null,
    canon: "official",
    tags: [],
    places: [],
    alt: `A picture of ${id}.`,
    img: { t: `${id}/t`, p: `${id}/p`, f: `${id}/f`, w, h, c: "#ffffff" },
    what,
    ...rest,
  };
}

const ITEMS: DesignItem[] = [
  item("selena-sheet", "mecha", ["selena"], { title: "Selena's mecha, design sheet" }),
  item("selena-head", "mecha", ["selena"], { title: "Selena's mecha, head" }),
  item("obsidia-card", "mecha", ["obsidia"], { title: "Obsidia's mecha, card" }),
  item("change-weapon", "weapon", ["change"], { title: "Chang'e's weapon, design card" }),
  item("change-father", "character", ["change"], { title: "Chang'e's father" }),
  item("change-mother", "character", ["change"], { title: "Chang'e's mother" }),
  item("lesley-weapon", "weapon", ["lesley"], { title: "Lesley's weapon" }),
  item("oro-soldier", "character", [], { title: "Soldier of Planet Oro" }),
  item("oro-droid", "droid", [], { title: "Oro training droid" }),
  item("logo", "other", [], { title: "The Aspirants, title logo" }),
];

const FILE: DesignFile = {
  v: 1,
  slug: "arts-design",
  room: "design",
  items: ITEMS,
  kinds: [
    { id: "character", name: "Characters", count: 3 },
    { id: "mecha", name: "Mecha", count: 3 },
  ],
};

const none = { q: "", kind: "", who: "" };
const ids = (list: readonly DesignItem[]) => list.map((i) => i.id);

describe("names", () => {
  it("spells the Aspirants as the site does", () => {
    expect(aspirantName("change")).toBe("Chang'e");
    expect(aspirantName("guinevere")).toBe("Guinevere");
    expect(aspirantName("mother-matrix")).toBe("Mother Matrix");
  });

  it("names a kind for a chip and for a sheet", () => {
    expect(kindName("weapon")).toBe("Weapons");
    expect(kindOne("weapon")).toBe("Weapon");
    expect(kindName("vehicle")).toBe("Vehicle");
  });

  it("numbers a sheet with two digits", () => {
    expect(sheetNumber(7)).toBe("07");
    expect(sheetNumber(22)).toBe("22");
  });

  it("writes a date the short way, and leaves other text alone", () => {
    expect(formatDate("2026-09-27")).toBe("27 Sep 2026");
    expect(formatDate("2026-01-03")).toBe("3 Jan 2026");
    expect(formatDate("September")).toBe("September");
    expect(formatDate("2026-13-01")).toBe("2026-13-01");
  });
});

describe("facets", () => {
  it("counts the kinds from the sheets, the most first, and keeps the head's names", () => {
    const kinds = kindFacets(FILE);
    expect(kinds.map((k) => [k.id, k.count])).toEqual([
      ["character", 3],
      ["mecha", 3],
      ["weapon", 2],
      ["droid", 1],
      ["other", 1],
    ]);
    expect(kinds[0]?.name).toBe("Characters");
    // Not in the head: named by the room.
    expect(kinds[2]?.name).toBe("Weapons");
  });

  it("has no kinds before the data arrives", () => {
    expect(kindFacets(null)).toEqual([]);
  });

  it("lists only the Aspirants that appear, the most sheets first, ties in page order", () => {
    const who = whoFacets(ITEMS);
    expect(who.map((f) => [f.id, f.count])).toEqual([
      ["change", 3],
      ["selena", 2],
      ["obsidia", 1],
      ["lesley", 1],
    ]);
    expect(who[0]?.name).toBe("Chang'e");
  });
});

describe("viewOf", () => {
  const index = buildDesignIndex(ITEMS);

  it("shows every sheet with no query, in the order of the data", () => {
    const v = viewOf(ITEMS, index, none);
    expect(v.shown).toHaveLength(10);
    expect(v.searched).toBe(10);
    expect(ids(v.shown)[0]).toBe("selena-sheet");
  });

  it("finds a sheet by every word of the search, whatever the case, accent or apostrophe", () => {
    expect(ids(viewOf(ITEMS, index, { ...none, q: "CHANGE weapon" }).shown)).toEqual([
      "change-weapon",
    ]);
    expect(ids(viewOf(ITEMS, index, { ...none, q: "chang'e" }).shown)).toEqual([
      "change-weapon",
      "change-father",
      "change-mother",
    ]);
    expect(viewOf(ITEMS, index, { ...none, q: "nothing like this" }).shown).toEqual([]);
  });

  it("finds a sheet by the name of its kind and of its Aspirant", () => {
    expect(ids(viewOf(ITEMS, index, { ...none, q: "droid" }).shown)).toEqual(["oro-droid"]);
    expect(viewOf(ITEMS, index, { ...none, q: "obsidia" }).shown).toHaveLength(1);
  });

  it("filters by a kind", () => {
    const v = viewOf(ITEMS, index, { ...none, kind: "mecha" });
    expect(ids(v.shown)).toEqual(["selena-sheet", "selena-head", "obsidia-card"]);
  });

  it("filters by an Aspirant, which leaves out the sheets of no Aspirant", () => {
    const v = viewOf(ITEMS, index, { ...none, who: "change" });
    expect(ids(v.shown)).toEqual(["change-weapon", "change-father", "change-mother"]);
  });

  it("asks for both: a sheet has to pass the kind and the Aspirant", () => {
    const v = viewOf(ITEMS, index, { ...none, kind: "character", who: "change" });
    expect(ids(v.shown)).toEqual(["change-father", "change-mother"]);
    expect(viewOf(ITEMS, index, { ...none, kind: "droid", who: "change" }).shown).toEqual([]);
  });

  it("counts a kind chip as what it would show, with the Aspirant and the search applied", () => {
    const v = viewOf(ITEMS, index, { ...none, who: "change" });
    expect(v.kinds.get("character")).toBe(2);
    expect(v.kinds.get("weapon")).toBe(1);
    expect(v.kinds.get("mecha")).toBeUndefined();
    expect(v.searched).toBe(10);
  });

  it("counts an Aspirant chip as what it would show, with the kind applied", () => {
    const v = viewOf(ITEMS, index, { ...none, kind: "weapon" });
    expect(v.who.get("change")).toBe(1);
    expect(v.who.get("lesley")).toBe(1);
    expect(v.who.get("selena")).toBeUndefined();
  });

  it("counts only what the search finds", () => {
    const v = viewOf(ITEMS, index, { ...none, q: "mecha" });
    expect(v.searched).toBe(3);
    expect(v.kinds.get("mecha")).toBe(3);
    expect(v.kinds.get("weapon")).toBeUndefined();
  });
});

describe("resolveQuery", () => {
  const kinds = kindFacets(FILE);
  const who = whoFacets(ITEMS);

  it("keeps a value that a chip has", () => {
    expect(resolveQuery({ q: "x", kind: "mecha", who: "selena" }, kinds, who)).toEqual({
      q: "x",
      kind: "mecha",
      who: "selena",
    });
  });

  it("drops a value from an old address that no chip has", () => {
    expect(resolveQuery({ q: "", kind: "vehicle", who: "fanny" }, kinds, who)).toEqual(none);
  });
});

describe("firstShown", () => {
  it("takes the first sheets of the data with no query", () => {
    expect(ids(firstShown(FILE, none, 3))).toEqual(["selena-sheet", "selena-head", "obsidia-card"]);
  });

  it("takes the first sheets after the filters of the address", () => {
    expect(ids(firstShown(FILE, { ...none, kind: "weapon" }, 3))).toEqual([
      "change-weapon",
      "lesley-weapon",
    ]);
    expect(ids(firstShown(FILE, { ...none, who: "change", q: "mother" }, 3))).toEqual([
      "change-mother",
    ]);
  });

  it("ignores a filter that does not exist", () => {
    expect(firstShown(FILE, { ...none, kind: "vehicle" }, 2)).toHaveLength(2);
  });
});

describe("isWideWriting", () => {
  it("is true for a wide sheet with writing and false for the rest", () => {
    expect(
      isWideWriting(item("a", "mecha", [], { tags: ["design sheet"], w: 2560, h: 1440 })),
    ).toBe(true);
    expect(
      isWideWriting(item("b", "character", [], { tags: ["size chart"], w: 1280, h: 420 })),
    ).toBe(true);
    // A square card is readable on a phone as it is.
    expect(isWideWriting(item("c", "weapon", [], { tags: ["card"], w: 898, h: 898 }))).toBe(false);
    // A wide picture with no writing.
    expect(isWideWriting(item("d", "weapon", [], { tags: ["weapon"], w: 2560, h: 1080 }))).toBe(
      false,
    );
  });
});
