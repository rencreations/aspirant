import { describe, expect, it } from "vitest";

import {
  DONE,
  DOWN_SCREENS,
  HOLD_SCREENS,
  UP_SCREENS,
  blackAt,
  blackCovers,
  arrivesDown,
  arrivesUp,
  shapeClock,
  sideAt,
  whiteAt,
} from "./liquid-math";

describe("the registry to film join", () => {
  it("is made of the way down and the way back", () => {
    expect(HOLD_SCREENS).toBeCloseTo(DOWN_SCREENS + UP_SCREENS);
    expect(DONE).toBeCloseTo(DOWN_SCREENS / HOLD_SCREENS);
    expect(DONE).toBeGreaterThan(0);
    expect(DONE).toBeLessThan(1);
  });

  it("covers the page white at the end of the way down and nothing before it", () => {
    expect(whiteAt(0)).toBe(0);
    expect(whiteAt(DONE)).toBe(1);
    expect(whiteAt(1)).toBe(1);
    expect(whiteAt(DONE / 2)).toBeCloseTo(0.5);
  });

  it("covers the page black at the start of the way back and nothing in the film's place", () => {
    expect(blackAt(1)).toBe(0);
    expect(blackAt(DONE)).toBe(1);
    expect(blackAt(0)).toBe(1);
    expect(blackAt((1 + DONE) / 2)).toBeCloseTo(0.5);
  });

  it("keeps the old timing of the shapes", () => {
    expect(shapeClock(1)).toBeCloseTo(0.56);
    expect(shapeClock(0)).toBe(0);
  });

  it("says which side of the join the page is on", () => {
    expect(sideAt(0)).toBe("registry");
    expect(sideAt(DONE - 0.01)).toBe("registry");
    expect(sideAt(DONE)).toBe("film");
    expect(sideAt(1)).toBe("film");
    expect(sideAt(1.4)).toBe("film");
  });

  it("counts a point a pixel or two from the cover point as being on it", () => {
    const len = 1944;
    expect(sideAt(DONE - 1 / len, len)).toBe("film");
    expect(sideAt(DONE - 5 / len, len)).toBe("registry");
    expect(blackCovers(DONE + 1 / len, len)).toBe(true);
    expect(blackCovers(DONE + 5 / len, len)).toBe(false);
  });

  it("plays the arrival for a step and takes a far jump as it is", () => {
    expect(arrivesDown(0.65)).toBe(true);
    expect(arrivesDown(1.04)).toBe(true);
    expect(arrivesDown(1.3)).toBe(true);
    expect(arrivesDown(3.2)).toBe(false);
    expect(arrivesUp(0.5)).toBe(true);
    expect(arrivesUp(0)).toBe(true);
    expect(arrivesUp(-0.2)).toBe(true);
    expect(arrivesUp(-2.9)).toBe(false);
  });
});
