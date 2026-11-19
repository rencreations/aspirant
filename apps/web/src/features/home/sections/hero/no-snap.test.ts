import { describe, expect, it } from "vitest";

import { homeLayout } from "../../kernel/where";

describe("the hero and the wall's close (round eight)", () => {
  it("are plain scroll linked passages: every zone has noSnap, so nothing finishes them by itself", () => {
    for (const id of ["hero", "aspirants"]) {
      const def = homeLayout().placed.find((p) => p.id === id)?.def;
      const zones = (def?.plays ?? []).filter((p) => p.span !== undefined);
      expect(zones.length, id).toBeGreaterThan(0);
      expect(
        zones.every((z) => z.noSnap === true),
        id,
      ).toBe(true);
    }
  });
});
