import { describe, expect, it } from "vitest";

import type { SearchEntry } from "../types";
import { countByCollection, searchEntries } from "./search-match";

const entries: SearchEntry[] = [
  { id: "a", c: "arts", t: "Layla, splash art", w: ["layla"], k: "splash official" },
  { id: "b", c: "video", t: "Awakening trailer", w: ["ruby", "angela"], k: "trailer official" },
  {
    id: "c",
    c: "voicelines",
    t: "Layla, line 1",
    w: ["layla"],
    k: "正義を執行するわよ i'm going to carry out justice",
  },
  { id: "d", c: "models", t: "Fanny and Layla, model", w: ["fanny", "layla"], k: "fan" },
];

describe("searchEntries", () => {
  it("returns nothing for an empty query", () => {
    expect(searchEntries(entries, "  ")).toEqual([]);
  });

  it("needs every word to match", () => {
    expect(searchEntries(entries, "layla splash").map((s) => s.entry.id)).toEqual(["a"]);
  });

  it("ranks a title hit above a keyword hit", () => {
    const ids = searchEntries(entries, "trailer").map((s) => s.entry.id);
    expect(ids[0]).toBe("b");
  });

  it("matches character slugs and Japanese text", () => {
    expect(searchEntries(entries, "ruby").map((s) => s.entry.id)).toEqual(["b"]);
    expect(searchEntries(entries, "正義").map((s) => s.entry.id)).toEqual(["c"]);
  });

  it("filters by collection and counts per collection", () => {
    expect(searchEntries(entries, "layla", "models").map((s) => s.entry.id)).toEqual(["d"]);
    expect(countByCollection(entries, "layla")).toEqual({ arts: 1, voicelines: 1, models: 1 });
  });
});
