import { describe, expect, it } from "vitest";

import { newBackdropPlan } from "../bolt/backdrop-plan";

import { NEBULA_FROM, planHandBackdrop } from "./backdrop-plan";
import { HAND_LAST } from "./stations";

describe("the hand's backdrop", () => {
  it("is nothing in the hand's lead and then rises to the nebula", () => {
    const a = newBackdropPlan();
    expect(planHandBackdrop(-0.3, a).on).toBe(false);
    expect(planHandBackdrop(NEBULA_FROM, a).on).toBe(false);
    expect(planHandBackdrop(NEBULA_FROM + 0.1, a).on).toBe(true);
    expect(planHandBackdrop(HAND_LAST, a).kind).toBe("galaxy");
  });

  it("keeps the nebula calm enough for the words", () => {
    const p = planHandBackdrop(HAND_LAST, newBackdropPlan());
    expect(p.options.amount).toBeLessThanOrEqual(0.95);
    expect(p.options.amount).toBeGreaterThan(0.5);
  });
});
