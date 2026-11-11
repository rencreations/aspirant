import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ArtsItem } from "../types";
import { ASPIRANT_LIST, ASPIRANT_SECTIONS, aspirantSectionOf, groupBySection } from "./sections";

const DIR = path.resolve(__dirname, "../../../../../../public/data/library");

function load(room: string): ArtsItem[] {
  const file = JSON.parse(fs.readFileSync(path.join(DIR, `arts-${room}.json`), "utf8")) as {
    items: ArtsItem[];
  };
  return file.items;
}

function item(chars: string[], pair: string | null = null): ArtsItem {
  return { id: chars.join("-") || "none", chars, pair } as unknown as ArtsItem;
}

describe("the Aspirant groups", () => {
  it("follow the five pairs, each pair after its two, then everyone and the world", () => {
    expect(ASPIRANT_LIST.map((s) => s.name)).toEqual([
      "Fanny",
      "Layla",
      "Fanny and Layla",
      "Ruby",
      "Angela",
      "Ruby and Angela",
      "Lesley",
      "Chang'e",
      "Lesley and Chang'e",
      "Guinevere",
      "Vexana",
      "Guinevere and Vexana",
      "Selena",
      "Obsidia",
      "Selena and Obsidia",
      "The Aspirants",
      "The world",
    ]);
  });

  it("puts a picture in one group by who is in it", () => {
    expect(aspirantSectionOf(item([]))).toBe("world");
    expect(aspirantSectionOf(item(["ruby"]))).toBe("ruby");
    expect(aspirantSectionOf(item(["layla", "fanny"]))).toBe("fanny-layla");
    expect(aspirantSectionOf(item(["selena", "obsidia"]))).toBe("selena-obsidia");
    // Two who are not a pair, and three or more, stand with everyone.
    expect(aspirantSectionOf(item(["obsidia", "vexana"]))).toBe("everyone");
    expect(aspirantSectionOf(item(["ruby", "angela", "layla"]))).toBe("everyone");
    // Someone who is not an Aspirant is the world's.
    expect(aspirantSectionOf(item(["stranger"]))).toBe("world");
  });
});

describe("groupBySection", () => {
  for (const room of ["scene", "game", "fanart", "others"]) {
    it(`keeps every picture of ${room} once and in its group's range`, () => {
      const items = load(room);
      const { items: ordered, parts } = groupBySection(items, ASPIRANT_SECTIONS);
      expect(ordered).toHaveLength(items.length);
      expect(new Set(ordered.map((i) => i.id)).size).toBe(items.length);
      let next = 0;
      for (const part of parts) {
        expect(part.start).toBe(next);
        expect(part.count).toBeGreaterThan(0);
        for (const i of ordered.slice(part.start, part.start + part.count)) {
          expect(aspirantSectionOf(i)).toBe(part.id);
        }
        next += part.count;
      }
      expect(next).toBe(items.length);
    });
  }

  it("keeps the order of the pictures inside a group", () => {
    const items = load("scene");
    const { items: ordered, parts } = groupBySection(items, ASPIRANT_SECTIONS);
    const part = parts.find((p) => p.id === "ruby");
    expect(part).toBeDefined();
    const mine = items.filter((i) => aspirantSectionOf(i) === "ruby").map((i) => i.id);
    expect(
      ordered.slice(part?.start, (part?.start ?? 0) + (part?.count ?? 0)).map((i) => i.id),
    ).toEqual(mine);
  });

  it("sends a picture whose group the list does not know to a last group, More", () => {
    const sections = { list: [{ id: "a", name: "A" }], of: (i: ArtsItem) => i.chars[0] ?? "" };
    const { parts } = groupBySection([item(["a"]), item(["z"]), item(["y"])], sections);
    expect(parts.map((p) => [p.id, p.count])).toEqual([
      ["a", 1],
      ["more", 2],
    ]);
  });
});
