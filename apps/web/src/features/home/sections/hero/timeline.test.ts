import { describe, expect, it } from "vitest";

import { RING_P } from "../../fx/image-field/formations";
import { STORY } from "../story";

import {
  SLIDE_RATE,
  TIMES,
  aspirantsS,
  clipOpen,
  cueOpacity,
  heroS,
  lineIn,
  lineOut,
  logoP,
  ramp,
  rowsBlend,
  slideRate,
  smooth,
  storyP,
  viewable,
} from "./timeline";

// The scenes are written on the story axis (`../story.ts`): nothing here depends on the scroll.
const HERO_STORY = STORY.hero.length;
const WALL = STORY.aspirants.start;
const ROWS = STORY.rows.start;
/** premotio's story is three units of 1.4 screens. */
const STORY_P_LENGTH = 4.2;

describe("the hero and aspirants table", () => {
  it("puts the aspirants where the hero ends (one scene, one clock)", () => {
    expect(WALL).toBe(HERO_STORY);
    expect(WALL + STORY.aspirants.length).toBeCloseTo(ROWS, 9);
  });

  it("turns the hero's virtual local into the story position and rests outside 0 to 1", () => {
    expect(heroS(0)).toBe(0);
    expect(heroS(1)).toBeCloseTo(HERO_STORY, 9);
    expect(heroS(-1)).toBe(0);
    expect(heroS(2.3)).toBeCloseTo(HERO_STORY, 9);
  });

  it("turns the aspirants' virtual local into the story: first the hero's play, then the close", () => {
    expect(aspirantsS(0)).toBe(0);
    expect(aspirantsS(0.5)).toBeCloseTo(heroS(0.5), 9);
    expect(aspirantsS(1)).toBeCloseTo(WALL, 9);
    expect(aspirantsS(2)).toBeCloseTo(ROWS, 9);
    expect(aspirantsS(3)).toBeCloseTo(ROWS, 9);
    expect(aspirantsS(-1)).toBe(0);
  });

  it("is continuous at the station between the two plays", () => {
    expect(aspirantsS(1 - 1e-9)).toBeCloseTo(aspirantsS(1 + 1e-9), 6);
  });

  it("is the hero's story up to 1, so the two plays that run in step agree", () => {
    for (let v = 0; v <= 1; v += 0.05) expect(aspirantsS(v)).toBeCloseTo(heroS(v), 9);
  });
});

describe("the story and the logo", () => {
  it("runs the story from 0 to 1 over premotio's three units", () => {
    expect(storyP(0)).toBe(0);
    expect(storyP(STORY_P_LENGTH / 2)).toBeCloseTo(0.5, 9);
    expect(storyP(STORY_P_LENGTH)).toBe(1);
    expect(storyP(9)).toBe(1);
    expect(storyP(-1)).toBe(0);
    // The wall stands before the play ends.
    expect(storyP(HERO_STORY)).toBe(1);
  });

  it("brings the logo to the bar before the ring stands, and not before the cards have begun", () => {
    expect(logoP(0)).toBe(0);
    expect(logoP(TIMES.logo[1])).toBe(1);
    // The ring stands at story p `gatherEnd` = 0.34, the middle of the hold is RING_P.
    expect(TIMES.logo[1]).toBeLessThan(0.34 * STORY_P_LENGTH);
    expect(TIMES.logo[1]).toBeLessThan(RING_P * STORY_P_LENGTH);
    // The first card is picked at p 0.05: the logo starts after that.
    expect(TIMES.logo[0]).toBeGreaterThan(0.05 * STORY_P_LENGTH);
  });

  it("is linear in the story, so it reverses", () => {
    const a = logoP(0.7);
    const b = logoP(0.9);
    expect(logoP(0.8)).toBeCloseTo((a + b) / 2, 9);
  });

  it("takes about a story screen to morph", () => {
    const span = TIMES.logo[1] - TIMES.logo[0];
    expect(span).toBeGreaterThan(0.7);
    expect(span).toBeLessThan(1.1);
  });
});

describe("the cue", () => {
  it("shows at rest and is gone by the time the logo moves", () => {
    expect(cueOpacity(0)).toBe(1);
    expect(cueOpacity(TIMES.logo[0])).toBe(0);
  });
});

describe("the clip", () => {
  it("is open while the cards fly, closes to the wall's frame, then opens with the rows", () => {
    expect(clipOpen(0)).toBe(1);
    expect(clipOpen(TIMES.clipClose[0] - 0.01)).toBe(1);
    expect(clipOpen(TIMES.clipClose[1])).toBe(0);
    expect(clipOpen(WALL)).toBe(0);
    expect(clipOpen(TIMES.clipOpen[0])).toBe(0);
    expect(clipOpen(TIMES.clipOpen[1])).toBe(1);
    expect(clipOpen(9)).toBe(1);
  });

  it("is continuous across the whole story", () => {
    let last = clipOpen(0);
    for (let S = 0; S <= 7; S += 0.005) {
      const v = clipOpen(S);
      expect(Math.abs(v - last)).toBeLessThan(0.05);
      last = v;
    }
  });

  it("is closed to the frame before the words arrive and the wall slides", () => {
    expect(clipOpen(TIMES.textIn[0])).toBeLessThan(0.4);
    expect(clipOpen(TIMES.slideIn[0])).toBeLessThan(0.1);
  });
});

describe("the wall's glide", () => {
  it("is still while the cards land, runs on the wall, and stops as the rows open", () => {
    expect(slideRate(0)).toBe(0);
    expect(slideRate(TIMES.slideIn[0])).toBe(0);
    expect(slideRate(WALL)).toBeCloseTo(SLIDE_RATE, 6);
    expect(slideRate(TIMES.slideOut[1])).toBe(0);
    expect(slideRate(7)).toBe(0);
  });

  it("is never negative and never above the rate", () => {
    for (let S = 0; S <= 7; S += 0.01) {
      const r = slideRate(S);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(SLIDE_RATE + 1e-9);
    }
  });

  it("starts after the cards have landed (story p 0.94)", () => {
    expect(TIMES.slideIn[0]).toBeGreaterThanOrEqual(0.94 * STORY_P_LENGTH - 1e-9);
  });
});

describe("the wall to the rows", () => {
  it("is the wall until the close and the rows after it", () => {
    expect(rowsBlend(0)).toBe(0);
    expect(rowsBlend(WALL)).toBe(0);
    expect(rowsBlend(TIMES.open[0])).toBe(0);
    expect(rowsBlend(TIMES.open[1])).toBe(1);
    expect(rowsBlend(8)).toBe(1);
  });

  it("starts with the close (the wall is the rest) and ends where the rows start (J2)", () => {
    expect(TIMES.open[0]).toBeGreaterThanOrEqual(WALL);
    expect(TIMES.open[1]).toBeLessThanOrEqual(ROWS + 1e-9);
    expect(TIMES.clipOpen[1]).toBeLessThanOrEqual(ROWS + 1e-9);
    expect(TIMES.slideOut[1]).toBeLessThanOrEqual(ROWS + 1e-9);
  });

  it("opens the clip with the rows, not after", () => {
    expect(TIMES.clipOpen[0]).toBeLessThanOrEqual(TIMES.open[0]);
    expect(TIMES.clipOpen[1]).toBeCloseTo(TIMES.open[1], 9);
  });
});

describe("the words", () => {
  it("arrive one line after another and are all in at the rest of the wall", () => {
    expect(lineIn(3.5, 0)).toBe(0);
    for (let k = 0; k < 4; k++) {
      expect(lineIn(TIMES.textIn[1], k)).toBe(1);
      expect(lineIn(WALL, k)).toBe(1);
      if (k > 0) expect(lineIn(4.0, k)).toBeLessThanOrEqual(lineIn(4.0, k - 1));
    }
  });

  it("start while the cards are still landing (not after: the play is short)", () => {
    expect(TIMES.textIn[0]).toBeLessThan(TIMES.clipClose[1]);
  });

  it("fold away in order, all gone at the end of the fold, and are whole at the rest of the wall", () => {
    for (let k = 0; k < 4; k++) {
      expect(lineOut(WALL, k)).toBe(0);
      expect(lineOut(TIMES.textOut[1], k)).toBe(1);
      if (k > 0) expect(lineOut(4.6, k)).toBeLessThanOrEqual(lineOut(4.6, k - 1));
    }
  });
});

describe("what can be pressed", () => {
  it("is the wall once the cards have landed, until the close begins", () => {
    expect(viewable(0)).toBe(false);
    expect(viewable(3.5)).toBe(false);
    expect(viewable(WALL)).toBe(true);
    expect(viewable(WALL + 0.05)).toBe(false);
    expect(viewable(TIMES.open[1])).toBe(false);
    expect(viewable(8)).toBe(false);
  });
});

describe("the helpers", () => {
  it("ramp and smooth", () => {
    expect(ramp(1, 0, 2)).toBe(0.5);
    expect(ramp(-1, 0, 2)).toBe(0);
    expect(smooth(1, 0, 2)).toBe(0.5);
    expect(smooth(3, 0, 2)).toBe(1);
  });
});
