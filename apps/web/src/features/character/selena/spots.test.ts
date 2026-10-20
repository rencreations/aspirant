import { describe, expect, it } from "vitest";

import { SELENA_TIMELINE } from "./timeline.generated";
import { HOTSPOT_PATHS, HOTSPOT_STEP, SPOTS } from "./spots";

describe("her touch point paths", () => {
  it("has a point for every spot, covering the whole idle loop", () => {
    for (const spot of SPOTS) {
      const path = HOTSPOT_PATHS[spot.id as keyof typeof HOTSPOT_PATHS];
      expect(path.length * HOTSPOT_STEP).toBe(SELENA_TIMELINE.loopFrames);
      for (const [x, y] of path) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(1);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(1);
      }
    }
  });

  it("plays a different short from each spot", () => {
    expect(new Set(SPOTS.map((s) => s.short)).size).toBe(SPOTS.length);
  });
});
