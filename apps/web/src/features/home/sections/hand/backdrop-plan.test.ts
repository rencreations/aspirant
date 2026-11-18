import { describe, expect, it } from "vitest";

import { BEAT } from "../bolt/stations";
import { newBackdropPlan, planBackdrop } from "../bolt/backdrop-plan";

import { NEBULA_FROM, planHandBackdrop } from "./backdrop-plan";
import { HAND_LAST } from "./stations";

describe("the hand's backdrop", () => {
  it("goes on from the fall's rest and then changes to the nebula", () => {
    const a = newBackdropPlan();
    const b = newBackdropPlan();
    expect(planHandBackdrop(-0.3, a)).toEqual(planBackdrop(BEAT.end, b));
    expect(planHandBackdrop(0, a).kind).toBe("aurora");
    expect(planHandBackdrop(NEBULA_FROM, a).kind).toBe("galaxy");
    expect(planHandBackdrop(HAND_LAST, a).kind).toBe("galaxy");
  });

  it("keeps the nebula calm enough for the words", () => {
    const p = planHandBackdrop(HAND_LAST, newBackdropPlan());
    expect(p.options.amount).toBeLessThanOrEqual(0.95);
    expect(p.options.amount).toBeGreaterThan(0.5);
  });
});
