import { describe, expect, it } from "vitest";

import { RING_P } from "../../fx/image-field/formations";
import { SECTIONS } from "../../kernel/sections";

import {
  ASPIRANTS_SCREENS,
  ASPIRANTS_START,
  HERO_SCREENS,
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

describe("the hero and aspirants table", () => {
  it("agrees with the registry (the lengths are the sections' own)", () => {
    const hero = SECTIONS.find((s) => s.id === "hero")!;
    const aspirants = SECTIONS.find((s) => s.id === "aspirants")!;
    expect(hero.screens).toBe(HERO_SCREENS);
    expect(aspirants.screens).toBe(ASPIRANTS_SCREENS);
    expect(ASPIRANTS_START).toBe(HERO_SCREENS);
  });

  it("turns a local into the scroll position", () => {
    expect(heroS(0)).toBe(0);
    expect(heroS(1)).toBeCloseTo(HERO_SCREENS, 9);
    expect(aspirantsS(0)).toBeCloseTo(HERO_SCREENS, 9);
    expect(aspirantsS(1)).toBeCloseTo(HERO_SCREENS + ASPIRANTS_SCREENS, 9);
  });
});

describe("the story and the logo", () => {
  it("runs the story from 0 to 1 over the hero's own length (premotio's three units)", () => {
    expect(storyP(0)).toBe(0);
    expect(storyP(HERO_SCREENS / 2)).toBeCloseTo(0.5, 9);
    expect(storyP(HERO_SCREENS)).toBe(1);
    expect(storyP(9)).toBe(1);
    expect(storyP(-1)).toBe(0);
  });

  it("brings the logo to the bar before the ring stands, and not before the cards have begun", () => {
    expect(logoP(0)).toBe(0);
    expect(logoP(TIMES.logo[1])).toBe(1);
    // The ring stands at story p `gatherEnd` = 0.34, the middle of the hold is RING_P.
    expect(TIMES.logo[1]).toBeLessThan(0.34 * HERO_SCREENS);
    expect(TIMES.logo[1]).toBeLessThan(RING_P * HERO_SCREENS);
    // The first card is picked at p 0.05: the logo starts after that.
    expect(TIMES.logo[0]).toBeGreaterThan(0.05 * HERO_SCREENS);
  });

  it("is linear in the scroll, so it reverses", () => {
    const a = logoP(0.7);
    const b = logoP(0.9);
    expect(logoP(0.8)).toBeCloseTo((a + b) / 2, 9);
  });

  it("takes about a screen to morph", () => {
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
    expect(clipOpen(4.5)).toBe(0);
    expect(clipOpen(TIMES.clipOpen[0])).toBe(0);
    expect(clipOpen(TIMES.clipOpen[1])).toBe(1);
    expect(clipOpen(9)).toBe(1);
  });

  it("is continuous across the whole scroll", () => {
    let last = clipOpen(0);
    for (let S = 0; S <= 7; S += 0.005) {
      const v = clipOpen(S);
      expect(Math.abs(v - last)).toBeLessThan(0.05);
      last = v;
    }
  });

  it("is closed to the frame before the words arrive and the wall slides", () => {
    expect(clipOpen(TIMES.textIn[0])).toBeLessThan(0.1);
    expect(clipOpen(TIMES.slideIn[0])).toBeLessThan(0.1);
  });
});

describe("the wall's glide", () => {
  it("is still while the cards land, runs under the words, and stops as the rows open", () => {
    expect(slideRate(0)).toBe(0);
    expect(slideRate(TIMES.slideIn[0])).toBe(0);
    expect(slideRate(4.5)).toBeCloseTo(SLIDE_RATE, 6);
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
    expect(TIMES.slideIn[0]).toBeGreaterThanOrEqual(0.94 * HERO_SCREENS - 1e-9);
  });
});

describe("the wall to the rows", () => {
  it("is the wall until the close and the rows after it", () => {
    expect(rowsBlend(0)).toBe(0);
    expect(rowsBlend(TIMES.open[0])).toBe(0);
    expect(rowsBlend(TIMES.open[1])).toBe(1);
    expect(rowsBlend(8)).toBe(1);
  });

  it("is finished before the rows section's lead begins (5.3), so the later section cannot cut it", () => {
    const rowsLeadStart = 5.8 - 0.5;
    expect(TIMES.open[1]).toBeLessThanOrEqual(rowsLeadStart + 1e-9);
    expect(TIMES.clipOpen[1]).toBeLessThanOrEqual(rowsLeadStart + 1e-9);
    expect(TIMES.slideOut[1]).toBeLessThanOrEqual(rowsLeadStart + 1e-9);
  });

  it("opens the clip with the rows, not after", () => {
    expect(TIMES.clipOpen[0]).toBeLessThanOrEqual(TIMES.open[0]);
    expect(TIMES.clipOpen[1]).toBeCloseTo(TIMES.open[1], 9);
  });
});

describe("the words", () => {
  it("arrive one line after another and are all in before the wall slides far", () => {
    expect(lineIn(3.7, 0)).toBe(0);
    for (let k = 0; k < 4; k++) {
      expect(lineIn(TIMES.textIn[1], k)).toBe(1);
      if (k > 0) expect(lineIn(3.95, k)).toBeLessThanOrEqual(lineIn(3.95, k - 1));
    }
  });

  it("fold away in order and are all gone by the end of the fold", () => {
    for (let k = 0; k < 4; k++) {
      expect(lineOut(TIMES.textOut[0] - 0.01, k)).toBe(0);
      expect(lineOut(TIMES.textOut[1], k)).toBe(1);
      if (k > 0) expect(lineOut(5.1, k)).toBeLessThanOrEqual(lineOut(5.1, k - 1));
    }
  });

  it("are shown at the middle of the section, where a focused control moves the page", () => {
    const middle = ASPIRANTS_START + ASPIRANTS_SCREENS / 2;
    for (let k = 0; k < 4; k++) {
      expect(lineIn(middle, k)).toBe(1);
      expect(lineOut(middle, k)).toBe(0);
    }
  });

  it("are shown (in 1, out 0) all through the middle of the section", () => {
    for (let k = 0; k < 4; k++) {
      expect(lineIn(4.6, k)).toBe(1);
      expect(lineOut(4.6, k)).toBe(0);
    }
  });
});

describe("what can be pressed", () => {
  it("is the wall once the cards have landed, until the rows have opened", () => {
    expect(viewable(0)).toBe(false);
    expect(viewable(3.5)).toBe(false);
    expect(viewable(4.5)).toBe(true);
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
