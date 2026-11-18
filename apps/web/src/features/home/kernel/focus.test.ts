import { describe, expect, it } from "vitest";

import { focusScreens } from "./focus";

describe("focusScreens", () => {
  it("goes to the middle of a section by default", () => {
    expect(focusScreens(3, undefined, undefined)).toBeCloseTo(1.5, 9);
  });

  it("uses the section's own fraction when it has one", () => {
    expect(focusScreens(4, 0.7, undefined)).toBeCloseTo(2.8, 9);
    expect(focusScreens(4, 0, undefined)).toBe(0);
  });

  it("uses the place a control names, in screens from the start", () => {
    expect(focusScreens(3.1, 0.7, "0.3")).toBeCloseTo(0.3, 9);
    expect(focusScreens(3.1, undefined, "2.4")).toBeCloseTo(2.4, 9);
    expect(focusScreens(3.1, undefined, "0")).toBe(0);
  });

  it("ignores a place that is not a number or lies outside the section", () => {
    expect(focusScreens(3, undefined, "")).toBeCloseTo(1.5, 9);
    expect(focusScreens(3, undefined, "soon")).toBeCloseTo(1.5, 9);
    expect(focusScreens(3, undefined, "-1")).toBeCloseTo(1.5, 9);
    expect(focusScreens(3, undefined, "3.5")).toBeCloseTo(1.5, 9);
  });
});
