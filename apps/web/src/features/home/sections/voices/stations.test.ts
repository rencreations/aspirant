import { describe, expect, it } from "vitest";

import { validatePlays } from "../../kernel/plays";

import { OUT_FROM } from "./choreo";
import {
  ENTER_SECONDS,
  LENGTHS,
  REST_V,
  VOICES_PLAYS,
  VOICES_SCREENS,
  VOICES_ZONES,
} from "./stations";

describe("the voices stations", () => {
  it("are a valid table: white at the start, the rest in the middle, the corners at the end", () => {
    expect(() => {
      validatePlays("voices", VOICES_PLAYS);
    }).not.toThrow();
    expect(VOICES_PLAYS.map((p) => p.from)).toEqual([0, REST_V]);
    expect(VOICES_PLAYS.map((p) => p.to)).toEqual([REST_V, 1]);
  });

  it("come in on a clock (a trigger) and go out by the scroll (a zone)", () => {
    const [enter, leave] = VOICES_PLAYS;
    expect(enter!.span).toBeUndefined();
    expect(enter!.seconds).toBe(ENTER_SECONDS);
    expect(leave!.span).toBeGreaterThan(0);
  });

  it("fire the way in a little after the section starts, when the white has covered the screen", () => {
    const enter = VOICES_PLAYS[0]!;
    expect(enter.at).toBeGreaterThan(0);
    expect(enter.at * VOICES_SCREENS).toBeCloseTo(LENGTHS.arrive, 9);
    // The page is held while it runs: it is short, as the owner asked of every scene.
    expect(ENTER_SECONDS).toBeLessThanOrEqual(2.5);
  });

  it("lay out in screens: the white, a long rest, the way out ending at the section's end", () => {
    const [leave] = VOICES_ZONES;
    expect(leave!.from).toBeCloseTo(LENGTHS.arrive + LENGTHS.rest, 9);
    expect(leave!.to).toBeCloseTo(VOICES_SCREENS, 9);
  });

  it("are short, and the rest is the long part (it is text and information)", () => {
    expect(LENGTHS.leave).toBeLessThanOrEqual(1);
    expect(LENGTHS.rest).toBeGreaterThanOrEqual(LENGTHS.leave);
    expect(LENGTHS.rest).toBeGreaterThanOrEqual(0.9);
  });

  it("begin the leave a little after the rest, so the rest is a true standing state", () => {
    expect(OUT_FROM).toBeGreaterThan(REST_V);
    expect(OUT_FROM - REST_V).toBeLessThan(0.1);
  });
});
