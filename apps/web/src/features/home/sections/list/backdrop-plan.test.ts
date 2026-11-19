import { describe, expect, it } from "vitest";

import { FRAME_COUNT } from "../hand/stations";

import { newListBackdrop, planListBackdrop } from "./backdrop-plan";
import { PICTURE_FRAMES } from "./frames";
import { FRAME_PALETTES } from "./palettes";

describe("the list's backdrop", () => {
  it("has a palette for every frame, four stops each, all pastel (the home is light only)", () => {
    expect(FRAME_PALETTES).toHaveLength(FRAME_COUNT);
    expect(FRAME_PALETTES).toHaveLength(PICTURE_FRAMES.length + 1);
    for (const stops of FRAME_PALETTES) {
      expect(stops).toHaveLength(4);
      for (const c of stops) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      const lum = stops.map((c) => {
        const n = parseInt(c.slice(1), 16);
        return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
      });
      for (const l of lum) expect(l).toBeGreaterThan(150);
    }
  });

  it("follows the picture in the window, and stays calm enough for the names", () => {
    const plan = newListBackdrop();
    planListBackdrop(0, 0, plan);
    expect(plan.options.colors).toBe(FRAME_PALETTES[0]);
    planListBackdrop(4.4, 0, plan);
    expect(plan.options.colors).toBe(FRAME_PALETTES[4]);
    planListBackdrop(9, 1, plan);
    expect(plan.options.colors).toBe(FRAME_PALETTES[9]);
    expect(plan.options.amount).toBeLessThanOrEqual(0.7);
    planListBackdrop(-1, 0, plan);
    expect(plan.options.colors).toBe(FRAME_PALETTES[0]);
  });
});
