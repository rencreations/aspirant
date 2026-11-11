import { describe, expect, it } from "vitest";

import {
  haystack,
  hiddenFactCount,
  hubPoints,
  isUnmet,
  lorePath,
  neighbours,
  pairSlug,
  parseTerms,
  relLabel,
  scoreEntry,
  slugFromPath,
  splitPairSlug,
  visibleFacts,
} from "./model";
import type { CodexEntry } from "./types";

const entry = (over: Partial<CodexEntry> = {}): CodexEntry => ({
  slug: "karina",
  kind: "person",
  sub: "rescue worker",
  name: "Karina",
  aka: ["the woman with the lamp"],
  line: "She found Selena in the mud.",
  short: "A rescue worker.",
  summary: "She carries a lamp.",
  first: 0,
  last: 60,
  tier: "A",
  rows: [],
  weapons: [],
  facts: [
    { n: 0, p: 12, t: "A soaked woman carries a lamp." },
    { n: 10, p: 3, t: "She keeps sweets in her pocket." },
    { n: 60, p: 9, t: "Her flat is two rooms." },
  ],
  rel: [
    { to: "selena", type: "guardian", dir: "out", n: 59, p: 1, t: "She kept her." },
    { to: "selena", type: "found", dir: "out", n: 0, p: 13, t: "She gathered her up." },
    { to: "rescue-team", type: "member", dir: "out", n: 10, p: 2, t: "She is on it." },
  ],
  seen: [0, 10, 60],
  explained: [],
  media: [],
  ...over,
});

describe("slugs", () => {
  it("orders a pair alphabetically and splits it back", () => {
    expect(pairSlug("layla", "fanny")).toBe("fanny--layla");
    expect(pairSlug("fanny", "layla")).toBe("fanny--layla");
    expect(splitPairSlug("fanny--layla")).toEqual(["fanny", "layla"]);
    expect(splitPairSlug("storm-citadel")).toBeNull();
  });

  it("reads the slug of an address and writes it back", () => {
    expect(slugFromPath("/collection/lore/")).toBe("");
    expect(slugFromPath("/collection/lore")).toBe("");
    expect(slugFromPath("/collection/lore/karina/")).toBe("karina");
    expect(slugFromPath("/collection/lore/fanny--layla")).toBe("fanny--layla");
    expect(slugFromPath("/collection/arts/karina/")).toBe("");
    expect(lorePath("karina")).toBe("/collection/lore/karina/");
    expect(lorePath("")).toBe("/collection/lore/");
  });
});

describe("relation labels", () => {
  it("reads a type from both sides", () => {
    expect(relLabel("serves", "out")).toBe("Serves");
    expect(relLabel("serves", "in")).toBe("Served by");
    expect(relLabel("friend", "in")).toBe("Friend");
    expect(relLabel("maker", "in")).toBe("Made by");
  });
});

describe("the reader's reach", () => {
  it("shows the facts up to the chapter the reader has reached", () => {
    const e = entry();
    expect(visibleFacts(e, -1)).toHaveLength(0);
    expect(visibleFacts(e, 0)).toHaveLength(1);
    expect(visibleFacts(e, 10)).toHaveLength(2);
    expect(visibleFacts(e, Infinity)).toHaveLength(3);
    expect(hiddenFactCount(e, 10)).toBe(1);
    expect(hiddenFactCount(e, 60)).toBe(0);
  });

  it("calls an entry unmet until its first chapter", () => {
    expect(isUnmet(entry({ first: 49 }), 10)).toBe(true);
    expect(isUnmet(entry({ first: 49 }), 49)).toBe(false);
    // Nothing read yet: even the prologue is ahead.
    expect(isUnmet(entry({ first: 0 }), -1)).toBe(true);
    expect(isUnmet(entry({ first: 0 }), 0)).toBe(false);
  });
});

describe("search", () => {
  it("parses terms and scores a name above a word of the text", () => {
    expect(parseTerms("The Storm  Citadel!")).toEqual(["the", "storm", "citadel"]);
    const h = haystack(entry());
    expect(scoreEntry(h, ["kar"])).toBeGreaterThan(scoreEntry(h, ["lamp"]));
    expect(scoreEntry(h, ["lamp"])).toBeGreaterThan(0);
    expect(scoreEntry(h, ["karina", "nothing"])).toBe(0);
  });
});

describe("neighbours", () => {
  it("groups the ties by entry, earliest first, within the reach", () => {
    const e = entry();
    const weight = (s: string) => (s === "selena" ? 5 : 0);
    const all = neighbours(e, Infinity, weight);
    expect(all.map((n) => n.slug)).toEqual(["selena", "rescue-team"]);
    expect(all[0]?.ties.map((t) => t.type)).toEqual(["found", "guardian"]);
    const early = neighbours(e, 5, weight);
    expect(early.map((n) => n.slug)).toEqual(["selena"]);
    expect(early[0]?.ties).toHaveLength(1);
  });
});

describe("the diagram", () => {
  it("puts the first neighbour at the top and spreads the rest round", () => {
    const pts = hubPoints(4, 800, 520);
    expect(pts).toHaveLength(4);
    expect(pts[0]?.x).toBeCloseTo(400);
    expect(pts[0]?.y).toBeLessThan(100);
    expect(pts[2]?.y).toBeGreaterThan(400);
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(800);
    }
  });
});
