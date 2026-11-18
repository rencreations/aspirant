import { describe, expect, it } from "vitest";

import { platePlace, shuffled, wallPictures } from "./order";

describe("shuffled", () => {
  it("is a permutation of 0 to n - 1", () => {
    for (const seed of [0, 1, 7, 99999, 4294967295]) {
      const order = shuffled(15, seed);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i));
    }
  });

  it("is the same for the same seed and different for another", () => {
    expect(shuffled(15, 3)).toEqual(shuffled(15, 3));
    expect(shuffled(15, 3)).not.toEqual(shuffled(15, 4));
  });
});

describe("wallPictures", () => {
  it("gives the first cards a picture each and repeats the rest from far away", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const pics = wallPictures(22, 15, seed);
      expect(pics).toHaveLength(22);
      expect(new Set(pics.slice(0, 15)).size).toBe(15);
      pics.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(15);
      });
      // A repeat is of a picture that is not on the next card.
      for (let i = 15; i < 22; i += 1) expect(pics[i]).not.toBe(pics[i - 1]);
    }
  });

  it("is only the unique cards when there are no more", () => {
    const pics = wallPictures(15, 15, 9);
    expect(new Set(pics).size).toBe(15);
  });
});

describe("platePlace", () => {
  const screen = { w: 1440, h: 900 };
  const size = { w: 280, h: 150 };

  it("stands beside the card on the side with more room, level with its middle", () => {
    const out = { x: 0, y: 0 };
    platePlace({ x: 200, y: 300, w: 200, h: 200 }, size, screen, out);
    expect(out.x).toBeGreaterThan(400);
    expect(out.y).toBeCloseTo(325, 6);
    platePlace({ x: 1100, y: 300, w: 200, h: 200 }, size, screen, out);
    expect(out.x + size.w).toBeLessThan(1100);
  });

  it("stays on the screen with a margin, wherever the card is", () => {
    const out = { x: 0, y: 0 };
    const cards = [
      { x: -100, y: -100, w: 300, h: 300 },
      { x: 1300, y: 800, w: 300, h: 300 },
      { x: 600, y: 0, w: 100, h: 100 },
      { x: 600, y: 850, w: 100, h: 100 },
    ];
    for (const card of cards) {
      platePlace(card, size, screen, out, 12);
      expect(out.x).toBeGreaterThanOrEqual(12);
      expect(out.y).toBeGreaterThanOrEqual(12);
      expect(out.x + size.w).toBeLessThanOrEqual(screen.w - 12);
      expect(out.y + size.h).toBeLessThanOrEqual(screen.h - 12);
    }
  });

  it("keeps clear of the top bar when it is given its height", () => {
    const out = { x: 0, y: 0 };
    platePlace({ x: 100, y: 0, w: 200, h: 120 }, size, screen, out, 12, 78);
    expect(out.y).toBeGreaterThanOrEqual(90);
    platePlace({ x: 100, y: 500, w: 200, h: 200 }, size, screen, out, 12, 78);
    expect(out.y).toBeCloseTo(525, 6);
  });
});
