import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BONE, CLIP } from "./constants";
import { pointSpecs } from "./points";
import { springGroup } from "./springs";

interface Facts {
  bones: Record<string, { three: string }>;
  clips: Record<string, unknown>;
  morphs: { targets: Array<{ name: string }> };
  springs: Record<string, string | Array<{ three: string }>>;
}

// The notes' facts file is the truth about the rig: every name the actor looks for must be in it.
const facts = JSON.parse(
  readFileSync(join(process.cwd(), "public/models/home/selena-r7.facts.json"), "utf8"),
) as Facts;
const names = new Set(Object.values(facts.bones).map((b) => b.three));

describe("the names the actor uses are in the rig", () => {
  it("the bones of constants", () => {
    const wanted = Object.values(BONE).flat();
    for (const name of wanted) expect(names.has(name), name).toBe(true);
  });

  it("the bones of the projected points", () => {
    for (const spec of pointSpecs()) expect(names.has(spec.bone), spec.bone).toBe(true);
  });

  it("the six clips", () => {
    for (const clip of Object.values(CLIP)) expect(clip in facts.clips, clip).toBe(true);
  });

  it("every spring bone of the notes is swung, and nothing else is", () => {
    const listed: string[] = [];
    for (const [key, rows] of Object.entries(facts.springs)) {
      if (key === "note" || !Array.isArray(rows)) continue;
      for (const row of rows) listed.push(row.three);
    }
    expect(listed.length).toBe(76);
    for (const name of listed) expect(springGroup(name), name).not.toBeNull();
    const swung = [...names].filter((n) => springGroup(n) !== null);
    expect(swung.sort()).toEqual([...listed].sort());
  });

  it("the face shapes the face module drives are the notes' fifteen", () => {
    expect(facts.morphs.targets.map((t) => t.name)).toHaveLength(15);
  });
});
