import { describe, expect, it } from "vitest";

import { playsOf } from "../../kernel/beat";
import { isZone, validatePlays } from "../../kernel/plays";
import { section as list } from "../list/index";

import { section as hand } from "./index";
import {
  FRAME_COUNT,
  FRAME_REST,
  frameRestScreens,
  HAND_DWELL,
  HAND_LAST,
  HAND_STEPS,
  LIST_DWELL,
  LIST_FIRST_AT,
  LIST_LAST,
  LIST_STEPS,
} from "./stations";

const end = (s: { atScreens: number; spanScreens?: number }): number =>
  s.atScreens + (s.spanScreens ?? 0);

describe("the zones of the hand and the list", () => {
  it("make tables the registry's sections accept, and the sections use them", () => {
    expect(() => {
      validatePlays("hand", playsOf(0, HAND_LAST, hand.screens, HAND_STEPS));
      validatePlays("list", playsOf(0, LIST_LAST, list.screens, LIST_STEPS));
    }).not.toThrow();
    expect(hand.plays).toEqual(playsOf(0, HAND_LAST, hand.screens, HAND_STEPS));
    expect(list.plays).toEqual(playsOf(0, LIST_LAST, list.screens, LIST_STEPS));
  });

  it("are all scroll zones: nothing on the list or the hand runs on a clock", () => {
    for (const step of [...HAND_STEPS, ...LIST_STEPS]) expect(step.spanScreens).toBeGreaterThan(0);
    for (const play of [...(hand.plays ?? []), ...(list.plays ?? [])]) {
      expect(isZone(play)).toBe(true);
    }
  });

  it("have one zone for the toss, one for each turn of the strip and one for the growth", () => {
    expect(LIST_STEPS).toHaveLength(1 + (FRAME_COUNT - 1) + 1);
    expect(LIST_STEPS[LIST_STEPS.length - 1]!.to).toBe(LIST_LAST);
    expect(LIST_STEPS[0]!.to).toBe(1);
    LIST_STEPS.forEach((step, i) => {
      // The zone `i` (after the toss) brings frame `i` to the window, which rests at beat 1 + i.
      if (i > 0 && i < LIST_STEPS.length - 1) expect(step.to).toBe(1 + i);
    });
  });

  it("keep every zone short: about a screen, a turn of the strip under half of one", () => {
    for (const step of [...HAND_STEPS, ...LIST_STEPS]) {
      expect(step.spanScreens!).toBeLessThanOrEqual(1.5);
    }
    for (const step of LIST_STEPS.slice(1, -1)) expect(step.spanScreens!).toBeLessThanOrEqual(0.5);
  });

  it("start the toss after the hand's tail, so the toss is the only scene on the scroll", () => {
    expect(LIST_STEPS[0]!.atScreens).toBeGreaterThanOrEqual(hand.tail);
    expect(LIST_STEPS[0]!.atScreens).toBe(LIST_FIRST_AT);
    // The hand's zone starts after its start and ends well before the join with the list.
    expect(HAND_STEPS[0]!.atScreens).toBeGreaterThan(0);
    expect(end(HAND_STEPS[0]!)).toBeLessThanOrEqual(hand.screens - list.lead);
    // The long rest on the words is before the join (0.4).
    expect(hand.screens - end(HAND_STEPS[0]!)).toBeCloseTo(HAND_DWELL, 9);
    expect(HAND_DWELL).toBeGreaterThanOrEqual(1);
  });

  it("rest on every frame between two zones, and keep the last zone clear of the next lead", () => {
    for (let i = 1; i < LIST_STEPS.length; i += 1) {
      const gap = LIST_STEPS[i]!.atScreens - end(LIST_STEPS[i - 1]!);
      expect(gap).toBeGreaterThanOrEqual(FRAME_REST - 1e-9);
    }
    // After the growth the visitor has the rest before the tail, which holds the next section's lead.
    expect(list.screens - end(LIST_STEPS[LIST_STEPS.length - 1]!)).toBeCloseTo(LIST_DWELL, 9);
    expect(LIST_DWELL).toBeGreaterThanOrEqual(0.5);
  });

  it("rest the page of a frame in the middle of the rest after the zone that brought it", () => {
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      const at = frameRestScreens(i);
      // The zone that brought frame `i` has ended, the next one has not begun.
      expect(end(LIST_STEPS[i]!)).toBeLessThan(at);
      expect(LIST_STEPS[i + 1]!.atScreens).toBeGreaterThan(at);
      expect(at - end(LIST_STEPS[i]!)).toBeCloseTo(FRAME_REST / 2, 9);
    }
    expect(frameRestScreens(-3)).toBe(frameRestScreens(0));
    expect(frameRestScreens(99)).toBe(frameRestScreens(FRAME_COUNT - 1));
  });
});
