import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { blockStrings } from "./search";
import { GROUPS, type LoreFile } from "./types";

const file = path.resolve(import.meta.dirname, "../../../../public/data/library/lore.json");
const data = JSON.parse(readFileSync(file, "utf8")) as LoreFile;

const DASH = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
const PATH = /[A-Za-z]:\\|\.(?:png|mp4|webm|flac)\b/;

describe("lore.json", () => {
  it("has the 28 official texts, the 14 places and the 10 entities", () => {
    expect(data.slug).toBe("lore");
    expect(data.texts).toHaveLength(28);
    expect(data.atlas.filter((a) => a.kind === "place")).toHaveLength(14);
    expect(data.atlas.filter((a) => a.kind === "entity")).toHaveLength(10);
    expect(data.items).toHaveLength(52);
  });

  it("has unique ids and a known group for every text", () => {
    const ids = [...data.texts.map((t) => t.id), ...data.atlas.map((a) => a.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(GROUPS.map((g) => g.id));
    for (const t of data.texts) expect(groups.has(t.group)).toBe(true);
  });

  it("marks exactly the two oldest texts as older, and puts them last in Stories", () => {
    const older = data.texts.filter((t) => t.rank === "older").map((t) => t.id);
    expect(older).toEqual(["lore-aspirant-backstory", "lore-renewed-hope"]);
    const stories = data.texts.filter((t) => t.group === "stories");
    expect(stories.slice(-2).map((t) => t.rank)).toEqual(["older", "older"]);
  });

  it("has unique heading ids inside each text", () => {
    for (const t of data.texts) {
      const heads = t.blocks.flatMap((b) => (b.t === "h" ? [b.id] : []));
      expect(new Set(heads).size).toBe(heads.length);
    }
  });

  it("links every atlas item to texts that exist, and every picture has its three sizes", () => {
    const ids = new Set(data.texts.map((t) => t.id));
    for (const a of data.atlas) {
      expect(a.texts.length).toBeGreaterThan(0);
      for (const id of a.texts) expect(ids.has(id)).toBe(true);
      expect(ids.has(a.from)).toBe(true);
      expect(a.img.t).toMatch(/\/t\.webp$/);
      expect(a.img.f).toMatch(/\/f\.webp$/);
      expect(a.img.w).toBeGreaterThan(0);
    }
  });

  it("quotes every atlas passage from its text", () => {
    const body = new Map(data.texts.map((t) => [t.id, t.blocks.flatMap(blockStrings).join("\n")]));
    for (const a of data.atlas) {
      expect(body.get(a.from)).toContain(a.text);
      for (const m of a.more) expect(body.get(m.from)).toContain(m.text);
    }
  });

  it("has all ten people with a card, a line and relations", () => {
    expect(data.people.map((p) => p.slug)).toEqual([
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "obsidia",
      "selena",
    ]);
    for (const p of data.people) {
      expect(p.text.length).toBeGreaterThan(40);
      expect(p.rels.length).toBeGreaterThan(5);
    }
  });

  it("follows the writing rules: no dashes, no file paths, no banned words", () => {
    const blob = JSON.stringify(data);
    expect(DASH.test(blob)).toBe(false);
    expect(PATH.test(blob)).toBe(false);
    expect(blob).not.toMatch(new RegExp(["con", "viction"].join(""), "i"));
    expect(blob).not.toMatch(new RegExp(["Ter", "enia|Ter", "inia|Terr", "enia"].join(""), "i"));
  });
});
