import { describe, expect, it } from "vitest";

import { playsOf } from "../../kernel/beat";
import { isZone, validatePlays } from "../../kernel/plays";
import { section as bolt } from "./index";
import { section as fall } from "../fall/index";

import {
  BEAT,
  BOLT_DWELL,
  BOLT_LAST,
  BOLT_STEPS,
  FALL_DWELL,
  FALL_STEPS,
  TURN_REST,
  WHEEL_FROM,
  WHEEL_ITEMS,
  WHEEL_STEP,
} from "./stations";

const end = (s: { atScreens: number; spanScreens?: number }): number =>
  s.atScreens + (s.spanScreens ?? 0);

describe("the zones of the bolt and the fall", () => {
  it("rest the wheel on one pair each, the last one where the fall begins", () => {
    expect(BOLT_STEPS).toHaveLength(WHEEL_ITEMS);
    BOLT_STEPS.forEach((step, i) => {
      expect(step.to).toBeCloseTo(WHEEL_FROM + i * WHEEL_STEP, 9);
    });
    expect(BOLT_LAST).toBeCloseTo(3.3, 9);
    expect(FALL_STEPS[FALL_STEPS.length - 1]!.to).toBe(BEAT.end);
  });

  it("are all scroll zones: nothing here runs on a clock or holds the page", () => {
    for (const step of [...BOLT_STEPS, ...FALL_STEPS]) expect(step.spanScreens).toBeGreaterThan(0);
    for (const play of [...(bolt.plays ?? []), ...(fall.plays ?? [])]) {
      expect(isZone(play)).toBe(true);
    }
  });

  it("keep every zone short: a turn of the wheel about half a screen, a scene about a screen", () => {
    for (const step of BOLT_STEPS.slice(1)) {
      expect(step.spanScreens!).toBeGreaterThanOrEqual(0.3);
      expect(step.spanScreens!).toBeLessThanOrEqual(0.6);
    }
    for (const step of [BOLT_STEPS[0]!, ...FALL_STEPS]) {
      expect(step.spanScreens!).toBeGreaterThanOrEqual(0.6);
      expect(step.spanScreens!).toBeLessThanOrEqual(1.5);
    }
  });

  it("gives the tables the registry's sections accept", () => {
    expect(() => {
      validatePlays("bolt", playsOf(0, BOLT_LAST, bolt.screens, BOLT_STEPS));
      validatePlays("fall", playsOf(BOLT_LAST, BEAT.end, fall.screens, FALL_STEPS));
    }).not.toThrow();
    expect(bolt.plays).toEqual(playsOf(0, BOLT_LAST, bolt.screens, BOLT_STEPS));
    expect(fall.plays).toEqual(playsOf(BOLT_LAST, BEAT.end, fall.screens, FALL_STEPS));
  });

  it("ends the last turn of the wheel before the fall's lead, so no zone has two scenes on screen", () => {
    const last = BOLT_STEPS[BOLT_STEPS.length - 1]!;
    expect(end(last)).toBeLessThanOrEqual(bolt.screens - fall.lead + 1e-9);
    expect(bolt.screens - end(last)).toBeCloseTo(BOLT_DWELL, 9);
    // The bolt has no tail: its range ends where the fall's rest on the last pair begins.
    expect(bolt.tail).toBe(0);
    expect(FALL_STEPS[0]!.atScreens).toBeGreaterThan(0);
  });

  it("ends the fall's last zone before the hand's lead, so the last line stands first", () => {
    const last = FALL_STEPS[FALL_STEPS.length - 1]!;
    expect(fall.screens - end(last)).toBeCloseTo(FALL_DWELL, 9);
    expect(end(last)).toBeLessThanOrEqual(fall.screens - 0.5 - 0.3 + 1e-9);
  });

  it("leaves a rest between two zones, longer on the words of the fall", () => {
    for (let i = 1; i < BOLT_STEPS.length; i += 1) {
      const gap = BOLT_STEPS[i]!.atScreens - end(BOLT_STEPS[i - 1]!);
      expect(gap).toBeGreaterThanOrEqual(TURN_REST - 1e-9);
    }
    // "5 Phases" is information: at least 0.4 screens between the two zones of the fall.
    expect(FALL_STEPS[1]!.atScreens - end(FALL_STEPS[0]!)).toBeGreaterThanOrEqual(0.4);
    // The rest on the fifth pair, up to the throw: the bolt's dwell and the fall's first screens.
    expect(BOLT_DWELL + FALL_STEPS[0]!.atScreens).toBeGreaterThanOrEqual(0.6);
  });

  it("puts the first line of the fall whole in the rest between its two zones", () => {
    expect(FALL_STEPS[0]!.to).toBe(BEAT.phases);
    expect(BEAT.phases).toBeGreaterThan(BEAT.launch);
    expect(BEAT.phases).toBeLessThan(BEAT.end);
  });
});
