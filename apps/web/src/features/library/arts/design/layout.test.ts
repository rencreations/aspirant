import { describe, expect, it } from "vitest";

import type { LibImage } from "../../types";
import {
  CAP_MAX,
  RAIL_AT,
  WIDE_AT,
  alignOffset,
  capHeight,
  previewWidth,
  sheetKey,
  sheetWidth,
} from "./layout";

const img = (w: number, h: number): LibImage => ({ t: "t", p: "p", f: "f", w, h, c: "#fff" });

describe("sheetWidth", () => {
  it("never goes above the pixels of the sheet", () => {
    expect(sheetWidth(img(396, 432), 1440, 900)).toBe(396);
    expect(sheetWidth(img(736, 265), 1920, 1080)).toBe(736);
    expect(sheetWidth(img(485, 511), 390, 844)).toBeLessThanOrEqual(485);
  });

  it("fits a big sheet to the room beside the notes on a laptop", () => {
    const w = sheetWidth(img(2560, 1440), 1440, 900);
    // The notes column and the gutters take about 500 px of 1440.
    expect(w).toBeGreaterThan(850);
    expect(w).toBeLessThan(1000);
  });

  it("is held by the height cap for a tall sheet", () => {
    const tall = sheetWidth(img(664, 825), 1440, 900);
    expect(tall).toBeLessThanOrEqual(capHeight(900) * (664 / 825) + 0.5);
    const cap = sheetWidth(img(2000, 4000), 1440, 900);
    expect(cap).toBeCloseTo(capHeight(900) * 0.5, 5);
  });

  it("uses the whole width, less the gutters and the plate, when the notes stand above", () => {
    const w = sheetWidth(img(2560, 1440), 390, 844);
    expect(w).toBeGreaterThan(330);
    expect(w).toBeLessThan(366);
    const tablet = sheetWidth(img(2560, 1440), 820, 1180);
    expect(tablet).toBeGreaterThan(700);
    expect(tablet).toBeLessThan(780);
  });

  it("caps the height on a very tall screen", () => {
    expect(capHeight(3000)).toBe(CAP_MAX);
    expect(capHeight(900)).toBeCloseTo(648, 5);
  });

  it("puts the notes beside the sheet from a tablet on its side and the rail from a laptop", () => {
    expect(WIDE_AT).toBeLessThan(RAIL_AT);
    const beside = sheetWidth(img(2560, 1440), WIDE_AT, 900);
    const above = sheetWidth(img(2560, 1440), WIDE_AT - 1, 900);
    expect(above).toBeGreaterThan(beside);
  });
});

describe("previewWidth", () => {
  it("is 1280 on the long side for a large sheet and the sheet's own size for a small one", () => {
    expect(previewWidth(img(2560, 1440))).toBe(1280);
    expect(previewWidth(img(2560, 1094))).toBe(1280);
    expect(previewWidth(img(898, 898))).toBe(898);
  });
});

describe("sheetKey", () => {
  const big = img(2560, 1440);

  it("draws the preview on a plain screen", () => {
    expect(sheetKey(big, 1440, 900, 1)).toBe("p");
    expect(sheetKey(big, 1920, 1080, 1)).toBe("p");
  });

  it("draws the full size where the preview would be soft", () => {
    expect(sheetKey(big, 1440, 900, 2)).toBe("f");
    expect(sheetKey(big, 1920, 1080, 1.5)).toBe("f");
  });

  it("never asks for the full size of a sheet whose preview is its whole size", () => {
    expect(sheetKey(img(898, 898), 1440, 900, 3)).toBe("p");
    expect(sheetKey(img(1280, 420), 1920, 1080, 3)).toBe("p");
  });

  it("keeps the preview on a phone, where the sheet is small", () => {
    expect(sheetKey(big, 390, 844, 2)).toBe("p");
  });
});

describe("alignOffset", () => {
  it("centres a section that fits under the bar", () => {
    expect(alignOffset(600, 900, 80)).toBe(-150);
  });

  it("stands a section that is too tall just under the bar", () => {
    expect(alignOffset(840, 900, 80)).toBe(-96);
    expect(alignOffset(1200, 900, 80)).toBe(-96);
  });
});
