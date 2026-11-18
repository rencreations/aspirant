import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PREVIEWS, STRIPS } from "./data";
import { filmItems } from "./preload";

describe("the film's loading list", () => {
  it("is the code, the trailer (waited) and the ten previews (deferred, in order)", () => {
    const items = filmItems();
    expect(items).toHaveLength(12);
    expect(items[0]!.id).toBe("chunk:home-film");
    const trailer = items[1]!;
    expect(trailer.id).toBe(`media:${STRIPS[0].path}`);
    expect(trailer.deferred).toBeUndefined();
    const previews = items.slice(2);
    expect(previews.map((i) => i.id)).toEqual(PREVIEWS.map((p) => `media:${p.path}`));
    for (const item of previews) expect(item.deferred).toBe(true);
    const priorities = previews.map((i) => i.priority ?? 50);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it("can leave the trailer behind the urgent items too", () => {
    const items = filmItems({ trailer: "deferred", trailerPriority: 5, previewPriority: 30 });
    expect(items[1]!.deferred).toBe(true);
    expect(items[1]!.priority).toBe(5);
    expect(items[2]!.priority).toBeCloseTo(30, 1);
  });

  it("weighs the files by their bytes", () => {
    const items = filmItems();
    expect(items[1]!.weight).toBe(Math.round(STRIPS[0].bytes / 1_000_000));
  });

  it("never pulls three.js into the list (it is in the bundle of every page)", () => {
    for (const file of ["preload.ts", "data.ts"]) {
      const text = readFileSync(path.resolve(import.meta.dirname, file), "utf8");
      expect(text).not.toMatch(/from "three"/);
      expect(text).not.toMatch(/from "\.\/(actor|index|video|plane)"/);
    }
  });
});
