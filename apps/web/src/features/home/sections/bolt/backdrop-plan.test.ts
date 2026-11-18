import { describe, expect, it } from "vitest";

import { BACKDROP_KINDS } from "../../fx/backdrop/palettes";

import { BACKDROP_AT, newBackdropPlan, planBackdrop } from "./backdrop-plan";
import { BOLT_LAST, BEAT, WHEEL_FROM, WHEEL_STEP } from "./stations";

describe("the bolt and fall backdrop", () => {
  const plan = newBackdropPlan();
  const kindAt = (t: number) => planBackdrop(t, plan).kind;

  it("asks for kinds that exist", () => {
    for (const t of [-0.5, 0, 1.3, 3.5, 5, 6.6, 7.1]) {
      expect(BACKDROP_KINDS).toContain(kindAt(t));
    }
  });

  it("rests every station on the same kind from both sections", () => {
    // The stations of the bolt are one kind, so the fall's lead (which asks at 3.3) agrees.
    for (let i = 0; i < 5; i += 1) expect(kindAt(WHEEL_FROM + i * WHEEL_STEP)).toBe("aurora");
    expect(kindAt(BOLT_LAST)).toBe("aurora");
    expect(kindAt(BEAT.end)).toBe("aurora");
  });

  it("changes kind away from the rests and in the order of the scene", () => {
    expect(BACKDROP_AT.strike).toBeGreaterThan(BOLT_LAST);
    expect(BACKDROP_AT.strike).toBeLessThan(BEAT.launch);
    expect(BACKDROP_AT.streaks).toBeGreaterThan(BEAT.launch);
    expect(BACKDROP_AT.night).toBeLessThan(BEAT.end);
    expect(kindAt(BEAT.launch)).toBe("lightning");
    expect(kindAt(5)).toBe("speed-lines");
  });

  it("rises from nothing in the lead and is calm enough for text at the rests", () => {
    expect(planBackdrop(-0.5, plan).options.amount).toBe(0);
    expect(planBackdrop(WHEEL_FROM, plan).options.amount).toBeGreaterThan(0.7);
    expect(planBackdrop(WHEEL_FROM, plan).options.amount).toBeLessThanOrEqual(1);
    expect(planBackdrop(BEAT.end, plan).options.speed).toBe(1);
  });

  it("is a pure function of t", () => {
    const a = JSON.stringify(planBackdrop(2.1, newBackdropPlan()));
    planBackdrop(5, plan);
    expect(JSON.stringify(planBackdrop(2.1, plan))).toBe(a);
  });
});
