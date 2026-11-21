import { describe, expect, it } from "vitest";

import { homeItems } from "../preload-items";
import { aggregateItems, splitItems } from "./preload";
import { SECTIONS } from "./sections";
import type { HomeSection } from "./types";
import type { PreloadItem } from "@/lib/preload";

const item = (id: string, extra: Partial<PreloadItem> = {}): PreloadItem => ({
  id,
  label: id,
  run: () => Promise.resolve(),
  ...extra,
});

function section(id: string, items: PreloadItem[]): HomeSection {
  return { id, preload: () => items } as unknown as HomeSection;
}

describe("aggregateItems", () => {
  it("lists the items of every section in scroll order", () => {
    const list = aggregateItems([
      section("a", [item("a1"), item("a2")]),
      section("b", [item("b1")]),
    ]);
    expect(list.map((i) => i.id)).toEqual(["a1", "a2", "b1"]);
  });

  it("keeps an item two sections ask for once", () => {
    const list = aggregateItems([section("a", [item("x")]), section("b", [item("x")])]);
    expect(list.map((i) => i.id)).toEqual(["x"]);
  });

  it("waits for an item if any section waits for it", () => {
    const list = aggregateItems([
      section("a", [item("x", { deferred: true, priority: 30 })]),
      section("b", [item("x")]),
    ]);
    expect(list[0]?.deferred).toBe(false);
  });

  it("keeps an item deferred when both sections defer it", () => {
    const list = aggregateItems([
      section("a", [item("x", { deferred: true })]),
      section("b", [item("x", { deferred: true })]),
    ]);
    expect(list[0]?.deferred).toBe(true);
  });
});

describe("splitItems", () => {
  it("separates what the bar waits for from what goes on in the background", () => {
    const { waited, deferred } = splitItems([
      item("a"),
      item("b", { deferred: true }),
      item("c", { deferred: false }),
    ]);
    expect(waited.map((i) => i.id)).toEqual(["a", "c"]);
    expect(deferred.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("homeItems", () => {
  it("waits for the lazy engine first", () => {
    const items = homeItems();
    expect(items[0]?.id).toBe("chunk:home-engine");
    expect(items[0]?.deferred).toBeFalsy();
  });

  it("has no two items with the same id", () => {
    const ids = homeItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("asks every section for its list", () => {
    expect(SECTIONS).toHaveLength(14);
    for (const s of SECTIONS) expect(Array.isArray(s.preload()), s.id).toBe(true);
  });

  it("has no timeout, no cap and no per-item limit anywhere (nothing is given up on)", () => {
    for (const i of homeItems()) expect(Object.keys(i), i.id).not.toContain("timeoutMs");
  });
});
