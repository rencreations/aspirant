import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PREVIEWS, TRAILER_FILM } from "./data";
import { filmItems } from "./preload";

describe("the film's loading list", () => {
  it("is the code, the trailer (waited) and the ten previews (deferred, in order)", () => {
    const items = filmItems();
    expect(items).toHaveLength(12);
    expect(items[0]!.id).toBe("chunk:home-film");
    const trailer = items[1]!;
    expect(trailer.id).toBe("stream:home-trailer");
    // The streamed first seconds are re-run for each visit (the stream element is made again).
    expect(trailer.memo).toBe(false);
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
    // The trailer weighs the bytes of the seconds that are waited for, not the 145 MB film.
    const seconds = (TRAILER_FILM.bytes * TRAILER_FILM.warmSeconds) / TRAILER_FILM.dur;
    expect(items[1]!.weight).toBe(Math.round(seconds / 1_000_000));
    expect(items[2]!.weight).toBe(Math.max(1, Math.round(PREVIEWS[0]!.bytes / 1_000_000)));
  });

  it("never pulls three.js into the list (it is in the bundle of every page)", () => {
    for (const file of ["preload.ts", "data.ts", "stream.ts"]) {
      const text = readFileSync(path.resolve(import.meta.dirname, file), "utf8");
      expect(text).not.toMatch(/from "three"/);
      expect(text).not.toMatch(/from "\.\/(actor|index|video|plane)"/);
    }
  });
});
