import { describe, expect, it } from "vitest";

import {
  azimuthDegrees,
  clock,
  humanBytes,
  itemsByGroup,
  matches,
  siteBySet,
  skillsByCharacter,
  stickerTilt,
  visibleSections,
} from "./filters";
import type { OthersItem, SkillItem } from "./types";

const base = { collection: "others" as const, pair: null, canon: "official" as const };

const skill = (id: string, who: "selena" | "vexana", label: string): SkillItem => ({
  ...base,
  id,
  title: `${who}, ${label}`,
  kind: "skill",
  group: "skills",
  label,
  chars: [who],
  tags: ["skill icon"],
  img: { t: "k", p: "k", f: "k", w: 100, h: 100, c: "#000000" },
});

const items: OthersItem[] = [
  {
    ...base,
    id: "m1",
    kind: "model",
    group: "models",
    title: "Fanny",
    chars: ["fanny"],
    tags: ["3d"],
    model: {
      format: "obj",
      dir: "d",
      obj: "a.obj",
      mtl: "a.mtl",
      verts: 1,
      tris: 1,
      bytes: 1,
      texBytes: 1,
      maps: {},
      rules: [],
      layers: ["body"],
      faces: [],
      files: 2,
      totalBytes: 2,
    },
  },
  skill("s1", "selena", "Passive"),
  skill("s2", "vexana", "Skill 1"),
  skill("s3", "selena", "Skill 2, abyssal"),
];

describe("matches", () => {
  it("matches every word, in any order, in the title, the tags or the character name", () => {
    expect(matches(items[0]!, "fanny 3d")).toBe(true);
    expect(matches(items[0]!, "3d FANNY")).toBe(true);
    expect(matches(items[0]!, "layla")).toBe(false);
    expect(matches(items[1]!, "selena icon")).toBe(true);
  });
  it("matches everything when the query is empty", () => {
    expect(matches(items[2]!, "   ")).toBe(true);
  });
});

describe("itemsByGroup and visibleSections", () => {
  it("sorts items into sections", () => {
    const by = itemsByGroup(items, "");
    expect(by.models).toHaveLength(1);
    expect(by.skills).toHaveLength(3);
    expect(by.emotes).toHaveLength(0);
  });
  it("shows every section with no filter, only matching sections when searching", () => {
    expect(visibleSections(itemsByGroup(items, ""), "", "")).toHaveLength(6);
    expect(visibleSections(itemsByGroup(items, "abyssal"), "", "abyssal")).toEqual(["skills"]);
  });
  it("shows a chosen section alone, even when it is empty", () => {
    expect(visibleSections(itemsByGroup(items, ""), "emotes", "")).toEqual(["emotes"]);
  });
});

describe("skillsByCharacter", () => {
  it("groups in data order", () => {
    const rows = skillsByCharacter(items.filter((i): i is SkillItem => i.kind === "skill"));
    expect(rows.map((r) => r.slug)).toEqual(["selena", "vexana"]);
    expect(rows[0]?.items).toHaveLength(2);
    expect(rows[0]?.name).toBe("Selena");
  });
});

describe("siteBySet", () => {
  it("groups by set", () => {
    const rows = siteBySet([
      { set: "menu", setLabel: "Menu art" },
      { set: "logo", setLabel: "Logo" },
      { set: "menu", setLabel: "Menu art" },
    ]);
    expect(rows.map((r) => [r.set, r.items.length])).toEqual([
      ["menu", 2],
      ["logo", 1],
    ]);
  });
});

describe("small helpers", () => {
  it("formats bytes", () => {
    expect(humanBytes(512)).toBe("512 B");
    expect(humanBytes(1536)).toBe("1.5 KB");
    expect(humanBytes(4_300_000)).toBe("4.1 MB");
  });
  it("wraps the azimuth into 0 to 359", () => {
    expect(azimuthDegrees(0)).toBe(0);
    expect(azimuthDegrees(Math.PI)).toBe(180);
    expect(azimuthDegrees(-Math.PI / 2)).toBe(270);
    expect(azimuthDegrees(Math.PI * 2)).toBe(0);
  });
  it("formats a clock", () => {
    expect(clock(7.4)).toBe("0:07");
    expect(clock(65)).toBe("1:05");
  });
  it("gives each sticker a stable tilt", () => {
    expect(stickerTilt(0)).toBe(stickerTilt(9));
    expect(Math.abs(stickerTilt(3))).toBeLessThan(5);
  });
});
