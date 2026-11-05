import { describe, expect, it } from "vitest";

import {
  doubleTapView,
  FIT,
  fileKind,
  formatBytes,
  isDoubleTap,
  neighbourIndexes,
  shareUrl,
  stepIndex,
  swipeStep,
  type Box,
} from "./lightbox-math";

const box: Box = { cw: 1000, ch: 600, iw: 2000, ih: 1200 };

describe("double tap", () => {
  it("needs two taps close in time and place", () => {
    expect(isDoubleTap(null, { t: 100, x: 5, y: 5 })).toBe(false);
    expect(isDoubleTap({ t: 100, x: 5, y: 5 }, { t: 300, x: 12, y: 9 })).toBe(true);
    expect(isDoubleTap({ t: 100, x: 5, y: 5 }, { t: 600, x: 5, y: 5 })).toBe(false);
    expect(isDoubleTap({ t: 100, x: 5, y: 5 }, { t: 200, x: 200, y: 5 })).toBe(false);
  });

  it("zooms a whole picture in on the spot and a zoomed one back out", () => {
    const zoomed = doubleTapView(FIT, 100, 50, box);
    expect(zoomed.z).toBeGreaterThanOrEqual(2.6);
    // The point under the finger stays where it was: the picture moves the other way.
    expect(zoomed.x).toBeLessThan(0);
    expect(doubleTapView(zoomed, 0, 0, box)).toEqual(FIT);
  });
});

describe("swipe", () => {
  it("goes next on a swipe left and previous on a swipe right", () => {
    expect(swipeStep(-120, 10)).toBe(-1);
    expect(swipeStep(120, -10)).toBe(1);
  });

  it("ignores short or mostly vertical moves", () => {
    expect(swipeStep(-30, 0)).toBe(0);
    expect(swipeStep(100, 90)).toBe(0);
  });
});

describe("text and address", () => {
  it("writes a file size for people", () => {
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(0)).toBeNull();
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(640 * 1024)).toBe("640 KB");
    expect(formatBytes(1.8 * 1024 * 1024)).toBe("1.8 MB");
  });

  it("names the kind of file", () => {
    expect(fileKind("arts/official/x/o.jpg")).toBe("JPG");
    expect(fileKind("a.webp")).toBe("WEBP");
    expect(fileKind("noext")).toBe("");
  });

  it("sets the item in the address and keeps the other filters", () => {
    expect(
      shareUrl("https://aspirant.cc/collection/arts/?who=layla#top", "i", "arts-official-x"),
    ).toBe("https://aspirant.cc/collection/arts/?who=layla&i=arts-official-x");
    expect(shareUrl("https://aspirant.cc/collection/arts/?i=old", "i", "new")).toBe(
      "https://aspirant.cc/collection/arts/?i=new",
    );
  });
});

describe("neighbours", () => {
  it("lists the pictures to warm, nearest first, looping", () => {
    expect(neighbourIndexes(5, 10)).toEqual([6, 4, 7, 3]);
    expect(neighbourIndexes(0, 10)).toEqual([1, 9, 2, 8]);
    expect(neighbourIndexes(0, 2)).toEqual([1]);
    expect(neighbourIndexes(0, 1)).toEqual([]);
  });

  it("steps and loops", () => {
    expect(stepIndex(9, 1, 10)).toBe(0);
    expect(stepIndex(0, -1, 10)).toBe(9);
    expect(stepIndex(3, 4, 10)).toBe(7);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});
