import { describe, expect, it } from "vitest";

import { validatePlays } from "../../kernel/plays";

import { OUT_FROM } from "./choreo";
import { LENGTHS, REST_V, VOICES_PLAYS, VOICES_SCREENS, VOICES_ZONES } from "./stations";

describe("the voices zones", () => {
  it("are a valid table: white at the start, the rest in the middle, the corners at the end", () => {
    expect(() => {
      validatePlays("voices", VOICES_PLAYS);
    }).not.toThrow();
    expect(VOICES_PLAYS.map((p) => p.from)).toEqual([0, REST_V]);
    expect(VOICES_PLAYS.map((p) => p.to)).toEqual([REST_V, 1]);
  });

  it("are scroll zones with no clock: every play has a span", () => {
    for (const p of VOICES_PLAYS) expect(p.span).toBeGreaterThan(0);
  });

  it("lay out in screens: enter, a long rest, leave, with the leave ending at the section's end", () => {
    const [enter, leave] = VOICES_ZONES;
    expect(enter!.from).toBe(0);
    expect(enter!.to).toBeCloseTo(LENGTHS.enter, 9);
    expect(leave!.from).toBeCloseTo(LENGTHS.enter + LENGTHS.rest, 9);
    expect(leave!.to).toBeCloseTo(VOICES_SCREENS, 9);
  });

  it("are short, and the rest is the long part (it is text and information)", () => {
    expect(LENGTHS.enter).toBeLessThanOrEqual(1);
    expect(LENGTHS.leave).toBeLessThanOrEqual(1);
    expect(LENGTHS.rest).toBeGreaterThanOrEqual(LENGTHS.enter);
    expect(LENGTHS.rest).toBeGreaterThanOrEqual(0.9);
  });

  it("begin the leave a little after the rest, so the rest is a true standing state", () => {
    expect(OUT_FROM).toBeGreaterThan(REST_V);
    expect(OUT_FROM - REST_V).toBeLessThan(0.1);
  });
});
