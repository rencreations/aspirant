import { describe, expect, it } from "vitest";

import { playsOf } from "../../kernel/beat";
import { validatePlays } from "../../kernel/plays";
import { section as list } from "../list/index";

import { section as hand } from "./index";
import {
  FRAME_COUNT,
  frameRestScreens,
  HAND_LAST,
  HAND_STEPS,
  LIST_LAST,
  LIST_STEPS,
} from "./stations";

describe("the stations of the hand and the list", () => {
  it("make tables the registry's sections accept, and the sections use them", () => {
    expect(() => {
      validatePlays("hand", playsOf(0, HAND_LAST, hand.screens, HAND_STEPS));
      validatePlays("list", playsOf(0, LIST_LAST, list.screens, LIST_STEPS));
    }).not.toThrow();
    expect(hand.plays).toEqual(playsOf(0, HAND_LAST, hand.screens, HAND_STEPS));
    expect(list.plays).toEqual(playsOf(0, LIST_LAST, list.screens, LIST_STEPS));
  });

  it("have one play for the toss, one for each turn of the strip and one for the growth", () => {
    expect(LIST_STEPS).toHaveLength(1 + (FRAME_COUNT - 1) + 1);
    expect(LIST_STEPS[LIST_STEPS.length - 1]!.to).toBe(LIST_LAST);
    expect(LIST_STEPS[0]!.to).toBe(1);
    LIST_STEPS.forEach((step, i) => {
      // The play `i` (after the toss) brings frame `i` to the window, which rests at beat 1 + i.
      if (i > 0 && i < LIST_STEPS.length - 1) expect(step.to).toBe(1 + i);
    });
  });

  it("keep every scene short: nothing holds the scroll for more than about two seconds", () => {
    for (const step of [...HAND_STEPS, ...LIST_STEPS]) {
      expect(step.seconds).toBeLessThanOrEqual(2.2);
    }
    // A turn of the strip is under a second.
    for (const step of LIST_STEPS.slice(1, -1)) expect(step.seconds).toBeLessThanOrEqual(0.8);
  });

  it("fire the toss after the hand's tail, so the hand's section is over when it holds the page", () => {
    expect(LIST_STEPS[0]!.atScreens).toBeGreaterThan(hand.tail);
    // The hand's one play fires after its start and well before the join.
    expect(HAND_STEPS[0]!.atScreens).toBeGreaterThan(0);
    expect(HAND_STEPS[0]!.atScreens).toBeLessThan(hand.screens - hand.lead);
  });

  it("leave a dwell of 0.4 to 1 screen between two triggers", () => {
    const ats = LIST_STEPS.map((s) => s.atScreens);
    for (let i = 1; i < ats.length; i += 1) {
      const gap = ats[i]! - ats[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(0.4 - 1e-9);
      expect(gap).toBeLessThanOrEqual(1);
    }
    // After the last play the visitor has a rest before the tail.
    expect(list.screens - ats[ats.length - 1]!).toBeGreaterThanOrEqual(0.4);
  });

  it("rest the page of a frame between the play that brought it and the next one", () => {
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      const at = frameRestScreens(i);
      const fired = LIST_STEPS.filter((s) => s.atScreens <= at).length;
      // The toss, then one play for each frame after the first.
      expect(fired).toBe(i + 1);
    }
    expect(frameRestScreens(-3)).toBe(frameRestScreens(0));
    expect(frameRestScreens(99)).toBe(frameRestScreens(FRAME_COUNT - 1));
  });
});
