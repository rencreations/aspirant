import { describe, expect, it } from "vitest";

import { STORY } from "../story";

import {
  appearAt,
  clearAt,
  clearRadius,
  filmAlong,
  leaveOf,
  MIN_SLIDE_PITCHES,
  morphAt,
  ROWS_BEATS,
  slideProgress,
  slideTravel,
} from "./journey";

// The rows' story is `STORY.rows` (`../story.ts`): the beats must end with it.
const ROWS_SCREENS = STORY.rows.length;

describe("the rows' beats on the scroll", () => {
  it("is ordered: slide, appear, clear, morph, and the morph ends with the section", () => {
    const B = ROWS_BEATS;
    expect(B.appear[0]).toBeGreaterThan(B.slide[0]);
    expect(B.clear[0]).toBeGreaterThanOrEqual(B.appear[1]);
    expect(B.morph[0]).toBeGreaterThanOrEqual(B.clear[1]);
    expect(B.morph[1]).toBe(ROWS_SCREENS);
  });
});

describe("the slide", () => {
  it("rests before the section and after the slide, and is monotone between", () => {
    expect(slideProgress(-0.5)).toBe(0);
    expect(slideProgress(0)).toBe(0);
    expect(slideProgress(ROWS_BEATS.slide[1])).toBe(1);
    expect(slideProgress(ROWS_SCREENS)).toBe(1);
    let last = 0;
    for (let s = 0; s <= ROWS_BEATS.slide[1]; s += 0.01) {
      const p = slideProgress(s);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it("ends on a whole number of pitches whatever the rows' phase, and slides at least the minimum", () => {
    const pitch = 770;
    for (const phase of [0, 1, 100, 769, 770, 5000.5, -300, 123456.7]) {
      const travel = slideTravel(phase, pitch);
      expect(travel).toBeGreaterThanOrEqual(MIN_SLIDE_PITCHES * pitch - 1e-6);
      expect(travel).toBeLessThanOrEqual((MIN_SLIDE_PITCHES + 1) * pitch + 1e-6);
      const end = (phase + travel) / pitch;
      expect(Math.abs(end - Math.round(end))).toBeLessThan(1e-9);
    }
  });

  it("puts the film at the far end of its ride at the start and at the middle at the end", () => {
    expect(filmAlong(0)).toBe(1);
    expect(filmAlong(ROWS_BEATS.slide[1])).toBe(0);
  });
});

describe("the film's beats", () => {
  it("appears, then the clearing runs, then it turns upright by the end of the section", () => {
    expect(appearAt(ROWS_BEATS.appear[0])).toBe(0);
    expect(appearAt(ROWS_BEATS.appear[1])).toBe(1);
    expect(clearAt(ROWS_BEATS.clear[0])).toBe(0);
    expect(clearAt(ROWS_BEATS.clear[1])).toBe(1);
    expect(morphAt(ROWS_BEATS.morph[0])).toBe(0);
    expect(morphAt(ROWS_SCREENS)).toBe(1);
    // J3: the film has fully appeared, the rows are still, the clearing is done.
    expect(appearAt(ROWS_SCREENS)).toBe(1);
    expect(clearAt(ROWS_SCREENS)).toBe(1);
  });
});

describe("the clearing's reach", () => {
  it("covers every distance at progress 1 and none at 0, nearest first", () => {
    const feather = 800;
    const max = 5000;
    expect(clearRadius(0, max, feather)).toBe(0);
    const full = clearRadius(1, max, feather);
    expect(leaveOf(full, max, feather)).toBe(1);
    expect(leaveOf(0, 1, feather)).toBe(0);
    const r = clearRadius(0.5, max, feather);
    expect(leaveOf(r, 100, feather)).toBeGreaterThan(leaveOf(r, 3000, feather));
  });
});
