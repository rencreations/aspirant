import { describe, expect, it } from "vitest";

import { activeIndex, clamp01, minutesLeft, readProgress } from "./reader-math";
import { highlight, outline, parseTerms, searchTexts, snippetsOf, windowAround } from "./search";
import type { LoreText } from "./types";

function text(id: string, title: string, blocks: LoreText["blocks"]): LoreText {
  return {
    id,
    title,
    group: "world",
    summary: "",
    blocks,
    minutes: 1,
    words: 10,
    chars: [],
    rank: "official",
    places: [],
  };
}

const storm = text("a", "Storm Citadel", [
  { t: "h", l: 2, x: "Storm Citadel", id: "storm-citadel" },
  { t: "p", x: "A colossal mothership, concealed within storm clouds." },
  { t: "h", l: 2, x: "Terrinia", id: "terrinia" },
  { t: "p", x: "The last bastion. Terrinia holds the Academy." },
]);
const other = text("b", "Terrinia", [{ t: "p", x: "Terrinia is humanity's final bastion." }]);

describe("parseTerms", () => {
  it("lower cases, drops punctuation and repeats", () => {
    expect(parseTerms("  Storm, storm! Cloud's ")).toEqual(["storm", "cloud's"]);
  });
  it("keeps at most six words", () => {
    expect(parseTerms("a b c d e f g h")).toHaveLength(6);
  });
  it("is empty for blanks", () => {
    expect(parseTerms(" ?! ")).toEqual([]);
  });
});

describe("highlight", () => {
  it("marks every match and keeps the rest", () => {
    const parts = highlight("Storm over the storm", ["storm"]);
    expect(parts.map((p) => p.text).join("")).toBe("Storm over the storm");
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(["Storm", "storm"]);
  });
  it("escapes regular expression characters", () => {
    expect(highlight("a (b) c", ["(b)"]).some((p) => p.hit)).toBe(true);
  });
  it("returns one plain part with no words", () => {
    expect(highlight("hello", [])).toEqual([{ text: "hello", hit: false }]);
  });
});

describe("windowAround", () => {
  it("keeps a short line whole", () => {
    expect(windowAround("short line", ["short"])).toBe("short line");
  });
  it("cuts a long line near the match with ellipses", () => {
    const long = `${"word ".repeat(60)}needle ${"tail ".repeat(60)}`;
    const w = windowAround(long, ["needle"]);
    expect(w).toContain("needle");
    expect(w.startsWith("...")).toBe(true);
    expect(w.endsWith("...")).toBe(true);
    expect(w.length).toBeLessThan(260);
  });
});

describe("searchTexts", () => {
  it("needs every word and ranks a title hit first", () => {
    const r = searchTexts([storm, other], "terrinia");
    expect(r.map((x) => x.text.id)).toEqual(["b", "a"]);
    expect(r[0]?.titleHit).toBe(true);
  });
  it("finds nothing for a word that is missing", () => {
    expect(searchTexts([storm, other], "terrinia zebra")).toEqual([]);
  });
  it("gives the heading a snippet sits under", () => {
    const s = snippetsOf(storm, ["academy"]);
    expect(s).toHaveLength(1);
    expect(s[0]?.headingId).toBe("terrinia");
  });
  it("returns nothing for an empty search", () => {
    expect(searchTexts([storm], "   ")).toEqual([]);
  });
});

describe("outline", () => {
  it("lists the headings in order", () => {
    expect(outline(storm.blocks).map((h) => h.id)).toEqual(["storm-citadel", "terrinia"]);
  });
});

describe("reader math", () => {
  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
  it("runs from 0 to 1 as the text scrolls by", () => {
    expect(readProgress(500, 3000, 900)).toBe(0);
    expect(readProgress(-1000, 3000, 900)).toBeGreaterThan(0.3);
    expect(readProgress(-4000, 3000, 900)).toBe(1);
    expect(readProgress(0, 0, 900)).toBe(0);
  });
  it("finds the active heading", () => {
    expect(activeIndex([300, 900, 1500], 100)).toBe(-1);
    expect(activeIndex([-300, 400, 1500], 500)).toBe(1);
    expect(activeIndex([], 0)).toBe(-1);
  });
  it("counts minutes left", () => {
    expect(minutesLeft(10, 0)).toBe(10);
    expect(minutesLeft(10, 0.55)).toBe(5);
    expect(minutesLeft(10, 1)).toBe(0);
  });
});
