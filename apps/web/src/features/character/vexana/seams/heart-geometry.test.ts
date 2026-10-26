import { describe, expect, it } from "vitest";

import { coverScale, heartClip, inHeart, openScale, progressAt, scaleAt } from "./heart-geometry";

describe("the heart of the hole", () => {
  it("holds its middle and not a far corner", () => {
    expect(inHeart(0, 0)).toBe(true);
    expect(inHeart(60, 60)).toBe(false);
    // The cleft at the top of the heart is outside it.
    expect(inHeart(0, -30)).toBe(false);
  });

  it("at its widest holds every point of the screen", () => {
    for (const [w, h] of [
      [1600, 900],
      [390, 844],
      [1024, 1366],
    ] as const) {
      const k = openScale(w, h);
      for (const [x, y] of [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [-w / 2, h / 2],
        [w / 2, h / 2],
        [0, -h / 2],
        [0, h / 2],
      ] as const) {
        expect(inHeart(x / k, y / k)).toBe(true);
      }
    }
  });

  it("shrinks from open to nothing as the progress goes from 0 to 1", () => {
    const open = openScale(1600, 900);
    expect(scaleAt(0, open)).toBeCloseTo(open);
    expect(scaleAt(1, open)).toBe(0);
    expect(scaleAt(0.5, open)).toBeLessThan(open);
    expect(scaleAt(0.3, open)).toBeGreaterThan(scaleAt(0.6, open));
  });

  it("covers a corner at the progress it says", () => {
    const open = openScale(1600, 900);
    const x = 800 - 70;
    const y = -450 + 28;
    const p = progressAt(coverScale(x, y), open);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    const before = scaleAt(p - 0.02, open);
    const after = scaleAt(p + 0.02, open);
    expect(inHeart(x / before, y / before)).toBe(true);
    expect(inHeart(x / after, y / after)).toBe(false);
  });

  it("makes an even-odd path with the screen and a heart", () => {
    const d = heartClip(1000, 600, 4);
    expect(d.startsWith('path(evenodd, "M0 0H1000.0V600.0H0Z M')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(4);
  });
});
