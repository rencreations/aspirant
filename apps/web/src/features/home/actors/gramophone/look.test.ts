import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PART, pickFor } from "./look";

const rig = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/models/home/gramophone-rig.json"),
    "utf8",
  ),
) as { nodes: Record<string, { children?: string[] }> };

/** Every node name the rig knows: the keys and the children they list. */
const names = new Set<string>();
for (const [name, node] of Object.entries(rig.nodes)) {
  names.add(name);
  for (const child of node.children ?? []) names.add(child);
}

describe("the gramophone's look", () => {
  it("names the nodes the rig names", () => {
    for (const name of Object.values(PART)) expect(names.has(name)).toBe(true);
    expect(new Set(Object.values(PART)).size).toBe(5);
  });

  it("draws the cabinet as wood: two bands, no glint", () => {
    const pick = pickFor(PART.cabinet);
    expect(pick.look).toBe("default");
    expect(pick.tune?.glint).toBe(0);
  });

  it("draws the horn, the crank and the soundbox as brass with a glint", () => {
    for (const name of [PART.horn, PART.crank, PART.soundbox]) {
      const pick = pickFor(name);
      expect(pick.look).toBe("metal");
      expect(pick.tune?.glint ?? 0).toBeGreaterThan(0.5);
    }
  });

  it("gives the flat platter no glint", () => {
    expect(pickFor(PART.platter).tune?.glint).toBe(0);
  });

  it("shifts the hue of the shade, not only its brightness", () => {
    const shade = pickFor(PART.horn).tune?.shade ?? [1, 1, 1];
    expect(Math.max(...shade) - Math.min(...shade)).toBeGreaterThan(0.15);
  });
});
