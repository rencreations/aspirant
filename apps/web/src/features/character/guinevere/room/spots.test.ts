import { describe, expect, it } from "vitest";

import { GUINEVERE_STAGE_BYTES, GUINEVERE_STAGE_TIMELINE } from "./timeline.generated";
import { ACTIONS } from "./spots";

describe("Guinevere's room actions", () => {
  it("has three buttons, in order, each for a short that the timeline has", () => {
    expect(ACTIONS.map((a) => a.label)).toEqual(["Action 1", "Action 2", "Action 3"]);
    for (const a of ACTIONS) {
      expect(GUINEVERE_STAGE_TIMELINE.shorts[a.short as "short-1"]).toBeDefined();
    }
  });

  it("names every file of every size once the encodes are done", () => {
    for (const tier of Object.values(GUINEVERE_STAGE_BYTES)) {
      for (const file of ["welcome.mp4", "idle.mp4", "short-1.mp4", "gallery-loop.mp4"]) {
        expect(tier[file]).toBeGreaterThan(0);
      }
    }
  });
});
