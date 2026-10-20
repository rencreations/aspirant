import { describe, expect, it } from "vitest";

import {
  CAPTION_SIZES,
  captionFontPx,
  clampCaption,
  containRect,
  cueLines,
  DEFAULT_CAPTIONS,
  normalizeCaptions,
} from "./caption-math";

describe("the picture inside its box", () => {
  it("fits a wide picture into a 16 by 9 box with bars above and below", () => {
    const r = containRect(1600, 900, 1920, 810);
    expect(r.width).toBeCloseTo(1600);
    expect(r.height).toBeCloseTo(675);
    expect(r.left).toBeCloseTo(0);
    expect(r.top).toBeCloseTo(112.5);
  });

  it("fits a tall picture with bars at the sides", () => {
    const r = containRect(1600, 900, 1080, 1920);
    expect(r.height).toBeCloseTo(900);
    expect(r.width).toBeCloseTo(506.25);
    expect(r.left).toBeCloseTo(546.875);
  });

  it("takes the whole box while the size of the picture is not known", () => {
    expect(containRect(800, 450, 0, 0)).toEqual({ left: 0, top: 0, width: 800, height: 450 });
  });
});

describe("the text size", () => {
  it("grows with the picture and with the chosen size, and never gets too small", () => {
    expect(captionFontPx(700, 1)).toBeGreaterThan(captionFontPx(400, 1));
    expect(captionFontPx(700, 3)).toBeGreaterThan(captionFontPx(700, 0));
    expect(captionFontPx(60, 0)).toBe(13);
  });

  it("is not big at the start: about four percent of the picture", () => {
    const px = captionFontPx(675, DEFAULT_CAPTIONS.size);
    expect(px / 675).toBeGreaterThan(0.03);
    expect(px / 675).toBeLessThan(0.05);
  });

  it("copes with a size out of range", () => {
    expect(captionFontPx(600, 99)).toBe(captionFontPx(600, CAPTION_SIZES.length - 1));
    expect(captionFontPx(600, -3)).toBe(captionFontPx(600, 0));
  });
});

describe("keeping the captions on the picture", () => {
  it("leaves a place that is already inside", () => {
    expect(clampCaption(0.5, 0.8, 400, 60, 1000, 500)).toEqual({ x: 0.5, y: 0.8 });
  });

  it("stops the box at the edges, not its centre", () => {
    const c = clampCaption(0, 1, 400, 60, 1000, 500);
    expect(c.x).toBeCloseTo(0.2);
    expect(c.y).toBeCloseTo(0.94);
  });

  it("keeps a box that is bigger than the picture in the middle", () => {
    expect(clampCaption(0.1, 0.9, 2000, 900, 1000, 500)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("the start", () => {
  it("has the captions on, inside the picture and not at the very bottom", () => {
    expect(DEFAULT_CAPTIONS.on).toBe(true);
    expect(DEFAULT_CAPTIONS.y).toBeGreaterThan(0.6);
    expect(DEFAULT_CAPTIONS.y).toBeLessThan(0.9);
    expect(DEFAULT_CAPTIONS.x).toBe(0.5);
  });

  it("starts from the defaults when nothing sensible was saved", () => {
    expect(normalizeCaptions(null)).toEqual(DEFAULT_CAPTIONS);
    expect(normalizeCaptions("x")).toEqual(DEFAULT_CAPTIONS);
    expect(normalizeCaptions({ size: "big", background: "neon", x: NaN })).toEqual(
      DEFAULT_CAPTIONS,
    );
  });

  it("keeps what was saved, within range", () => {
    expect(normalizeCaptions({ on: false, size: 3, background: "solid", x: 0.2, y: 2 })).toEqual({
      on: false,
      size: 3,
      background: "solid",
      x: 0.2,
      y: 1,
    });
  });
});

describe("the words of a cue", () => {
  it("removes tags and splits lines", () => {
    expect(cueLines("<i>Shall</i> we begin?\nYes &amp; no")).toEqual([
      "Shall we begin?",
      "Yes & no",
    ]);
    expect(cueLines("  \n ")).toEqual([]);
  });
});
