import { describe, expect, it } from "vitest";

import { playsOf } from "../../kernel/beat";
import { validatePlays } from "../../kernel/plays";
import { section as bolt } from "./index";
import { section as fall } from "../fall/index";

import {
  BEAT,
  BOLT_LAST,
  BOLT_STEPS,
  FALL_STEPS,
  WHEEL_FROM,
  WHEEL_ITEMS,
  WHEEL_STEP,
} from "./stations";

describe("the stations of the bolt and the fall", () => {
  it("rest the wheel on one pair each, the last one where the fall begins", () => {
    expect(BOLT_STEPS).toHaveLength(WHEEL_ITEMS);
    BOLT_STEPS.forEach((step, i) => {
      expect(step.to).toBeCloseTo(WHEEL_FROM + i * WHEEL_STEP, 9);
    });
    expect(BOLT_LAST).toBeCloseTo(3.3, 9);
    expect(FALL_STEPS[0]!.to).toBe(BEAT.end);
  });

  it("keep every scene short: nothing holds the scroll for more than about three seconds", () => {
    for (const step of [...BOLT_STEPS, ...FALL_STEPS]) {
      expect(step.seconds).toBeLessThanOrEqual(3);
      expect(step.seconds).toBeGreaterThanOrEqual(0.5);
    }
    // The wheel turns one pair in about half a second.
    for (const step of BOLT_STEPS.slice(1)) expect(step.seconds).toBeLessThanOrEqual(0.7);
  });

  it("gives the tables the registry's sections accept", () => {
    expect(() => {
      validatePlays("bolt", playsOf(0, BOLT_LAST, bolt.screens, BOLT_STEPS));
      validatePlays("fall", playsOf(BOLT_LAST, BEAT.end, fall.screens, FALL_STEPS));
    }).not.toThrow();
    expect(bolt.plays).toEqual(playsOf(0, BOLT_LAST, bolt.screens, BOLT_STEPS));
    expect(fall.plays).toEqual(playsOf(BOLT_LAST, BEAT.end, fall.screens, FALL_STEPS));
  });

  it("fires the last wheel turn before the fall's lead, so no two scenes are on screen at once", () => {
    const lastAt = BOLT_STEPS[BOLT_STEPS.length - 1]!.atScreens;
    expect(lastAt).toBeLessThan(bolt.screens - fall.lead);
    // The bolt has no tail: its range ends where the fall's throw can fire.
    expect(bolt.tail).toBe(0);
    expect(FALL_STEPS[0]!.atScreens).toBeGreaterThan(0);
  });

  it("leaves a dwell of 0.4 to 1 screen between two triggers", () => {
    const ats = BOLT_STEPS.map((s) => s.atScreens);
    for (let i = 1; i < ats.length; i += 1) {
      const gap = ats[i]! - ats[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(0.4);
      expect(gap).toBeLessThanOrEqual(1);
    }
    // From the last wheel turn to the throw: the rest of the bolt plus the fall's own threshold.
    const toThrow = bolt.screens - ats[ats.length - 1]! + FALL_STEPS[0]!.atScreens;
    expect(toThrow).toBeGreaterThanOrEqual(0.4);
    expect(toThrow).toBeLessThanOrEqual(1);
  });

  it("holds the whole chain of a hard flick to about seven seconds", () => {
    const total = [...BOLT_STEPS, ...FALL_STEPS].reduce((sum, s) => sum + s.seconds, 0);
    expect(total).toBeLessThan(8);
  });
});
