import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SKILL_CLIPS } from "./clips.generated";
import {
  CLIP_LABEL,
  EXTRAS,
  HOW_IT_FLOWS,
  levelHead,
  OVERVIEW,
  RATINGS,
  SKILLS,
  STATS,
} from "./skills-data";
import { skillClipPath, skillIconPath, skillPosterPath, skillSmallPath } from "./skills-media";

const publicDir = join(process.cwd(), "public");
const onDisk = (path: string) => existsSync(join(publicDir, path));

describe("Obsidia's skills", () => {
  it("lists her passive and three skills, each with a clip", () => {
    expect(SKILLS.map((s) => s.slot)).toEqual(["Passive", "Skill 1", "Skill 2", "Ultimate"]);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const s of SKILLS) {
      expect(s.text.length, s.id).toBeGreaterThan(0);
      expect(SKILL_CLIPS[s.clip], s.id).toBeDefined();
    }
  });

  it("gives every table one value for each level (six for the skills, three for the ultimate)", () => {
    for (const s of SKILLS) {
      for (const row of s.scaling) {
        expect(row.values.length, `${s.id} ${row.label}`).toBe(s.slot === "Ultimate" ? 3 : 6);
      }
      if (s.scaling[0])
        expect(levelHead(s.scaling[0].values.length)).toHaveLength(s.scaling[0].values.length);
    }
  });

  it("has the numbers of the wiki", () => {
    const needle = SKILLS.find((s) => s.id === "abyssal-bone-needle")!;
    expect(needle.scaling.find((r) => r.label === "Base damage")?.values[0]).toBe("325");
    const ult = SKILLS.find((s) => s.slot === "Ultimate")!;
    expect(ult.scaling.find((r) => r.label === "Cooldown")?.values).toEqual([
      "40.0",
      "35.0",
      "30.0",
    ]);
    expect(STATS.find((s) => s.label === "HP")?.fifteenth).toBe("4420");
    expect(RATINGS.map((r) => r.value)).toEqual([2, 7, 1, 4]);
    expect(OVERVIEW.some((o) => o.value === "Marksman")).toBe(true);
    expect(HOW_IT_FLOWS.length).toBeGreaterThan(2);
  });

  it("has every icon, poster and clip on disk, with their sizes, and a label for each clip", () => {
    for (const s of SKILLS) {
      expect(onDisk(skillIconPath(s.icon)), s.icon).toBe(true);
      if (s.altIcon) expect(onDisk(skillIconPath(s.altIcon.file)), s.altIcon.file).toBe(true);
    }
    for (const id of Object.keys(SKILL_CLIPS) as Array<keyof typeof SKILL_CLIPS>) {
      expect(onDisk(skillClipPath(id)), id).toBe(true);
      expect(onDisk(skillSmallPath(id)), `${id} small`).toBe(true);
      expect(onDisk(skillPosterPath(id)), `${id} poster`).toBe(true);
      expect(SKILL_CLIPS[id].smallBytes).toBeGreaterThan(0);
      expect(CLIP_LABEL[id]).toBeTruthy();
    }
    for (const e of EXTRAS) expect(SKILL_CLIPS[e.clip]).toBeDefined();
  });

  it("follows the writing rules", () => {
    const text = [...SKILLS.flatMap((s) => [s.name, ...s.text, ...s.notes]), ...HOW_IT_FLOWS].join(
      " ",
    );
    const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
    expect(dashes.test(text)).toBe(false);
  });
});
