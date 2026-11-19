import { describe, expect, it } from "vitest";

import { homeLayout } from "../../kernel/where";

import {
  focusScreensOf,
  STRIP_AT,
  STRIP_DWELL,
  STRIP_FOCUS_AT,
  STRIP_FOCUS_RANGE,
  STRIP_SCREENS,
} from "./dwell";
import { section } from "./index";

describe("the strip's dwells", () => {
  it("add up to the section's length and put the thresholds in order", () => {
    expect(STRIP_SCREENS).toBeCloseTo(
      STRIP_DWELL.small + STRIP_DWELL.window + STRIP_DWELL.orbit,
      9,
    );
    expect(STRIP_AT.window).toBeGreaterThan(0);
    expect(STRIP_AT.orbit).toBeGreaterThan(STRIP_AT.window);
    expect(STRIP_AT.orbit).toBeLessThan(1);
  });

  it("are the scroll between two plays, in screens", () => {
    expect((STRIP_AT.window - 0) * STRIP_SCREENS).toBeCloseTo(STRIP_DWELL.small, 9);
    expect((STRIP_AT.orbit - STRIP_AT.window) * STRIP_SCREENS).toBeCloseTo(STRIP_DWELL.window, 9);
    expect((1 - STRIP_AT.orbit) * STRIP_SCREENS).toBeCloseTo(STRIP_DWELL.orbit, 9);
  });

  it("give the rests with words more scroll than the one with a button (the owner's rule)", () => {
    expect(STRIP_DWELL.orbit).toBeGreaterThanOrEqual(0.8);
    expect(STRIP_DWELL.small).toBeGreaterThanOrEqual(0.8);
    expect(STRIP_DWELL.window).toBeLessThan(STRIP_DWELL.orbit);
  });

  it("are the plays of the registry's section", () => {
    const plays = section.plays!;
    expect(section.screens).toBeCloseTo(STRIP_SCREENS, 9);
    expect(plays.map((p) => p.at)).toEqual([0, STRIP_AT.window, STRIP_AT.orbit, 1]);
    expect(homeLayout().placed.find((p) => p.id === "strip")?.def.screens).toBeCloseTo(
      STRIP_SCREENS,
      9,
    );
  });

  it("send the keyboard to a place inside the dwell of the rest that shows the control", () => {
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
