import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SKILL_CLIPS } from "./clips.generated";
import { CLIP_LABEL, EXTRAS, HOW_IT_FLOWS, LEVEL_HEAD, SKILLS } from "./skills-data";
import { skillClipPath, skillIconPath, skillPosterPath } from "./skills-media";

const pub = join(process.cwd(), "public");
const text = () =>
  [
    ...SKILLS.flatMap((s) => [s.name, s.slot, ...s.tags, ...s.text, ...s.notes, s.clipNote ?? ""]),
    ...EXTRAS.flatMap((e) => [e.title, e.note]),
    ...HOW_IT_FLOWS,
  ].join(" ");

describe("Selena's skills", () => {
  it("has the passive and a skill 1, skill 2 and ultimate in each form", () => {
    expect(SKILLS.filter((s) => s.form === "both").map((s) => s.slot)).toEqual(["Passive"]);
    for (const form of ["elven", "abyssal"] as const)
      expect(SKILLS.filter((s) => s.form === form).map((s) => s.slot)).toEqual([
        "Skill 1",
        "Skill 2",
        "Ultimate",
      ]);
  });

  it("matches the wiki's names", () => {
    expect(SKILLS.map((s) => s.name)).toEqual([
      "Symbiosis",
      "Abyssal Trap",
      "Soul Eater",
      "Abyssal Arrow",
      "Garotte",
      "Primal Darkness",
      "Blessing of the Moon Goddess",
    ]);
  });

  it("gives every level table one value per level", () => {
    for (const s of SKILLS)
      for (const row of s.scaling) {
        const n = row.values.length;
        expect([4, 6]).toContain(n);
        expect(LEVEL_HEAD[n === 4 ? "four" : "six"]).toHaveLength(n);
      }
  });

  it("has every icon, poster and clip on disk and a label for every clip", () => {
    for (const s of SKILLS) expect(existsSync(join(pub, skillIconPath(s.icon))), s.icon).toBe(true);
    for (const id of Object.keys(SKILL_CLIPS) as Array<keyof typeof SKILL_CLIPS>) {
      expect(existsSync(join(pub, skillClipPath(id))), id).toBe(true);
      expect(existsSync(join(pub, skillPosterPath(id))), id).toBe(true);
      expect(CLIP_LABEL[id]).toBeTruthy();
    }
    for (const s of SKILLS) expect(s.clip in SKILL_CLIPS).toBe(true);
    for (const e of EXTRAS) expect(e.clip in SKILL_CLIPS).toBe(true);
  });

  it("shows Selena's half of the split screen for the idle and interactive clips", () => {
    expect(SKILL_CLIPS.idle.portrait).toBe(true);
    expect(SKILL_CLIPS.interactive.portrait).toBe(true);
    expect(SKILL_CLIPS.trap.portrait).toBe(false);
  });

  it("follows the writing rules", () => {
    const t = text();
    expect(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`).test(t),
    ).toBe(false);
    expect(t.toLowerCase()).not.toContain(["convic", "tion"].join(""));
  });
});
