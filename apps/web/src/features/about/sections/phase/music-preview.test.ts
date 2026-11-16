import { describe, expect, it } from "vitest";

import { hasMark } from "./music-marks";
import { loopsAt, PREVIEW_SECONDS } from "./music-preview";

describe("the loop of a preview", () => {
  it("plays the first seconds of a long film and goes back", () => {
    expect(loopsAt(3, 308)).toBe(false);
    expect(loopsAt(PREVIEW_SECONDS - 0.1, 308)).toBe(false);
    expect(loopsAt(PREVIEW_SECONDS, 308)).toBe(true);
    expect(loopsAt(200, 308)).toBe(true);
  });

  it("goes back just before the end of a film shorter than its window", () => {
    expect(loopsAt(9.5, 10)).toBe(false);
    expect(loopsAt(9.8, 10)).toBe(true);
  });

  it("keeps its window while the length is not known", () => {
    expect(loopsAt(5, Number.NaN)).toBe(false);
    expect(loopsAt(PREVIEW_SECONDS + 1, Number.NaN)).toBe(true);
    expect(loopsAt(5, Infinity)).toBe(false);
  });

  it("takes another window when given one", () => {
    expect(loopsAt(8, 308, 6)).toBe(true);
    expect(loopsAt(5, 308, 6)).toBe(false);
  });
});

describe("the marks of the platforms", () => {
  it("has one for each platform the collection names", () => {
    for (const name of ["Spotify", "Apple Music", "YouTube"]) expect(hasMark(name)).toBe(true);
  });

  it("has none for a name it does not know", () => {
    expect(hasMark("Somewhere else")).toBe(false);
    expect(hasMark("toString")).toBe(false);
  });
});
