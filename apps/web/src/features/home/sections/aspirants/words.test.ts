import { describe, expect, it } from "vitest";

import { HERO_REST, HERO_ZONE } from "../hero";

import { SLIDE_ORIGIN } from "../../fx/image-field/scroll-slide";

import {
  LINE_SECONDS,
  LINE_STAGGER,
  WORDS_BACK_MARGIN,
  WORDS_LEAVE_V,
  WORDS_RETURN_V,
  WORDS_SECONDS,
  WORDS_SHOW_AT,
  lineAt,
  stepWordsClock,
  wordsShown,
} from "./words";

describe("the words' trigger", () => {
  it("the plane's slide starts where the hero's zone ends", () => {
    expect(SLIDE_ORIGIN).toBeCloseTo(HERO_REST + HERO_ZONE, 9);
  });

  it("shows the words once the wall has landed and the close has not begun", () => {
    expect(wordsShown(false, WORDS_SHOW_AT - 0.01, 0)).toBe(false);
    expect(wordsShown(false, WORDS_SHOW_AT, 1)).toBe(true);
    expect(wordsShown(false, WORDS_SHOW_AT + 1, 1)).toBe(true);
    expect(wordsShown(false, WORDS_SHOW_AT + 1, 1.5)).toBe(false);
    expect(wordsShown(false, WORDS_SHOW_AT + 3, 2)).toBe(false);
  });

  it("has two sides to each threshold, so a page that rests on one never flickers", () => {
    // Shown, it stays shown a little way back and a little way into the close.
    expect(wordsShown(true, WORDS_SHOW_AT - WORDS_BACK_MARGIN / 2, 0)).toBe(true);
    expect(wordsShown(true, WORDS_SHOW_AT - WORDS_BACK_MARGIN * 1.5, 0)).toBe(false);
    const between = (WORDS_RETURN_V + WORDS_LEAVE_V) / 2;
    expect(wordsShown(true, WORDS_SHOW_AT + 1, between)).toBe(true);
    expect(wordsShown(true, WORDS_SHOW_AT + 1, WORDS_LEAVE_V + 0.01)).toBe(false);
    // Hidden, it comes back only at the rest, a hair of the zone included (where the snap leaves the page).
    expect(wordsShown(false, WORDS_SHOW_AT + 1, between)).toBe(false);
    expect(wordsShown(false, WORDS_SHOW_AT + 1, 1)).toBe(true);
    expect(wordsShown(false, WORDS_SHOW_AT + 1, 1.02)).toBe(true);
  });

  it("never hides the words anywhere inside the rest, whatever the scroll does there", () => {
    let shown = false;
    for (let S = WORDS_SHOW_AT; S <= WORDS_SHOW_AT + 1; S += 0.003) {
      shown = wordsShown(shown, S, 1);
      expect(shown, `S ${S}`).toBe(true);
    }
    for (let S = WORDS_SHOW_AT + 1; S >= WORDS_SHOW_AT - WORDS_BACK_MARGIN / 2; S -= 0.003) {
      shown = wordsShown(shown, S, 1);
      expect(shown, `S ${S}`).toBe(true);
    }
  });
});

describe("the words' clock", () => {
  it("runs in in under a second and out faster", () => {
    let t = 0;
    for (let i = 0; i < 53; i++) t = stepWordsClock(t, true, 1 / 60);
    expect(t).toBeLessThan(WORDS_SECONDS);
    for (let i = 0; i < 30; i++) t = stepWordsClock(t, true, 1 / 60);
    expect(t).toBe(WORDS_SECONDS);
    let frames = 0;
    while (t > 0 && frames < 600) {
      t = stepWordsClock(t, false, 1 / 60);
      frames++;
    }
    expect(frames / 60).toBeLessThan(0.45);
  });

  it("turns round part way without a jump", () => {
    let t = 0;
    for (let i = 0; i < 25; i++) t = stepWordsClock(t, true, 1 / 60);
    const before = t;
    t = stepWordsClock(t, false, 1 / 60);
    expect(before - t).toBeLessThan(0.05);
    expect(t).toBeGreaterThan(0);
  });

  it("does not jump on a stalled frame", () => {
    expect(stepWordsClock(0, true, 5)).toBeLessThanOrEqual(0.1);
  });

  it("brings the lines one after another, each settling into place", () => {
    expect(lineAt(0, 0)).toBe(0);
    expect(lineAt(WORDS_SECONDS, 2)).toBeCloseTo(1, 6);
    // The title is further on than the button at any time in between.
    for (let t = 0.05; t < WORDS_SECONDS; t += 0.05) {
      expect(lineAt(t, 0)).toBeGreaterThanOrEqual(lineAt(t, 1));
      expect(lineAt(t, 1)).toBeGreaterThanOrEqual(lineAt(t, 2));
    }
    expect(2 * LINE_STAGGER + LINE_SECONDS).toBeLessThanOrEqual(WORDS_SECONDS + 1e-9);
    // Monotone in time.
    let last = 0;
    for (let t = 0; t <= WORDS_SECONDS; t += 0.01) {
      const a = lineAt(t, 1);
      expect(a).toBeGreaterThanOrEqual(last - 1e-12);
      last = a;
    }
  });
});
