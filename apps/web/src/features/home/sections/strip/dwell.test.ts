import { describe, expect, it } from "vitest";

import { homeLayout } from "../../kernel/where";

import {
  focusScreensOf,
  STRIP_AT,
  STRIP_AT_SCREENS,
  STRIP_DWELL,
  STRIP_FOCUS_AT,
  STRIP_FOCUS_RANGE,
  STRIP_SCREENS,
  STRIP_SPAN,
  STRIP_ZONES,
} from "./dwell";
import { section } from "./index";

describe("the strip's scroll lengths", () => {
  it("add up to the section's length and put the scenes in order", () => {
    expect(STRIP_SCREENS).toBeCloseTo(
      STRIP_ZONES.words +
        STRIP_DWELL.small +
        STRIP_DWELL.window +
        STRIP_DWELL.orbit +
        STRIP_ZONES.exit,
      9,
    );
    expect(STRIP_AT.window).toBeGreaterThan(STRIP_SPAN.words);
    expect(STRIP_AT.orbit).toBeGreaterThan(STRIP_AT.window);
    expect(STRIP_AT.exit).toBeGreaterThan(STRIP_AT.orbit);
    expect(STRIP_AT.exit + STRIP_SPAN.exit).toBeCloseTo(1, 9);
  });

  it("are the scroll between two scenes, in screens", () => {
    expect(STRIP_AT.window * STRIP_SCREENS - STRIP_ZONES.words).toBeCloseTo(STRIP_DWELL.small, 9);
    expect((STRIP_AT.orbit - STRIP_AT.window) * STRIP_SCREENS).toBeCloseTo(STRIP_DWELL.window, 9);
    expect((STRIP_AT.exit - STRIP_AT.orbit) * STRIP_SCREENS).toBeCloseTo(STRIP_DWELL.orbit, 9);
    expect(STRIP_AT.exit * STRIP_SCREENS).toBeCloseTo(STRIP_AT_SCREENS.exit, 9);
  });

  it("keep the zones short (the owner wants short) and the rests with words longer than the one between triggers", () => {
    expect(STRIP_ZONES.words).toBeLessThanOrEqual(1.5);
    expect(STRIP_ZONES.exit).toBeGreaterThanOrEqual(0.6);
    expect(STRIP_ZONES.exit).toBeLessThanOrEqual(1.5);
    expect(STRIP_DWELL.orbit).toBeGreaterThanOrEqual(0.8);
    expect(STRIP_DWELL.window).toBeLessThan(STRIP_DWELL.orbit);
    // A clock play keeps a clear dwell after a zone: the snap lands on the zone's end.
    expect(STRIP_DWELL.small).toBeGreaterThanOrEqual(0.15);
  });

  it("are the plays of the registry's section: two zones and two triggers", () => {
    const plays = section.plays!;
    expect(section.screens).toBeCloseTo(STRIP_SCREENS, 9);
    expect(plays.map((p) => p.at)).toEqual([0, STRIP_AT.window, STRIP_AT.orbit, STRIP_AT.exit]);
    expect(plays.map((p) => p.span !== undefined)).toEqual([true, false, false, true]);
    expect(homeLayout().placed.find((p) => p.id === "strip")?.def.screens).toBeCloseTo(
      STRIP_SCREENS,
      9,
    );
  });

  it("send the keyboard to a place inside the rest that shows the control", () => {
    for (const kind of ["small", "window", "hold"] as const) {
      const [from, to] = STRIP_FOCUS_RANGE[kind];
      expect(STRIP_FOCUS_AT[kind], kind).toBeGreaterThan(from);
      expect(STRIP_FOCUS_AT[kind], kind).toBeLessThan(to);
    }
  });

  it("never name a place past the end of the section (the shell would fall back to the middle)", () => {
    for (const kind of ["small", "window", "hold"] as const) {
      expect(Number(focusScreensOf(STRIP_FOCUS_AT[kind]))).toBeLessThanOrEqual(STRIP_SCREENS);
      expect(Number(focusScreensOf(STRIP_FOCUS_AT[kind]))).toBeGreaterThanOrEqual(0);
    }
  });

  it("keep the three ranges apart and in order", () => {
    expect(STRIP_FOCUS_RANGE.small[1]).toBeLessThan(STRIP_FOCUS_RANGE.window[0]);
    expect(STRIP_FOCUS_RANGE.window[1]).toBeLessThan(STRIP_FOCUS_RANGE.hold[0]);
  });
});
