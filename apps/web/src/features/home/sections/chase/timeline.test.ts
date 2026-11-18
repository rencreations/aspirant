import { describe, expect, it } from "vitest";

import {
  DRAGON_LENGTH,
  HEAD_LEAD,
  T,
  beatAt,
  dollPlace,
  dragonHeadX,
  dragonPlace,
  dragonSpan,
  geometry,
  tetraRun,
  tetraStand,
  wordsAmount,
  zoomAt,
} from "./timeline";

const SIZES: ReadonlyArray<[number, number]> = [
  [1440, 900],
  [1706, 950],
  [390, 844],
];

describe("the story order", () => {
  it("goes: doll, dragon, Tetra, stop, wave, sit, read, words", () => {
    expect(T.dollFrom).toBeLessThan(T.dragonFrom);
    expect(T.dragonFrom).toBeLessThan(T.tetraFrom);
    expect(T.dollTo).toBeLessThan(T.tetraTo);
    expect(T.tetraTo).toBeLessThan(T.panted);
    expect(T.panted).toBeLessThan(T.waved);
    expect(T.waved).toBeLessThan(T.sat);
    expect(T.zoomFrom).toBeLessThan(T.zoomTo);
    expect(T.wordsFrom).toBeLessThan(T.wordsTo);
    expect(T.wordsTo).toBeLessThan(T.wordsOutFrom);
    expect(T.wordsOutTo).toBeLessThan(1);
  });
});

describe.each(SIZES)("the runners at %i x %i", (w, h) => {
  const g = geometry(w, h);

  it("has the doll run from beyond the left edge to beyond the right, and only then", () => {
    const o = { x: 0, y: 0, dist: 0, on: false };
    expect(dollPlace(T.dollFrom - 0.01, g, o).on).toBe(false);
    expect(dollPlace(T.dollFrom + 0.001, g, o).x).toBeLessThan(-w / 2);
    expect(dollPlace((T.dollFrom + T.dollTo) / 2, g, o).on).toBe(true);
    expect(dollPlace(T.dollTo - 0.001, g, o).x).toBeGreaterThan(w / 2);
    expect(dollPlace(T.dollTo + 0.01, g, o).on).toBe(false);
  });

  it("keeps the dragon head behind the doll for as long as she is on the screen", () => {
    const o = { x: 0, y: 0, dist: 0, on: false };
    for (let l = T.dragonFrom + 0.002; l < T.dollTo; l += 0.004) {
      const doll = dollPlace(l, g, o).x;
      expect(dragonHeadX(l, g)).toBeLessThan(doll - 0.1 * w);
    }
  });

  it("brings the dragon in at the left edge and has its tail clear the right edge", () => {
    const span = dragonSpan(g);
    expect(span.from).toBe(T.dragonFrom);
    expect(span.to).toBeGreaterThan(T.dollTo);
    expect(span.to).toBeLessThan(T.tetraTo);
    expect(dragonHeadX(span.from, g)).toBeLessThanOrEqual(-w / 2);
    const tail = dragonHeadX(span.to, g) - DRAGON_LENGTH * g.dragonH;
    expect(tail).toBeGreaterThanOrEqual(w / 2);
    const o = { x: 0, y: 0, pitch: 0, roll: 0, on: false };
    expect(dragonPlace((span.from + span.to) / 2, g, o).on).toBe(true);
    expect(dragonPlace(span.to + 0.01, g, o).on).toBe(false);
    expect(dragonPlace(span.from - 0.01, g, o).on).toBe(false);
    // The body block is HEAD_LEAD behind the head.
    expect(dragonPlace(0.2, g, o).x).toBeCloseTo(dragonHeadX(0.2, g) - HEAD_LEAD * g.dragonH, 6);
  });

  it("has Tetra run in from the left and stop in the middle, slowing down", () => {
    const o = { x: 0, y: 0, speed: 0, running: false };
    expect(tetraRun(T.tetraFrom, g, o).x).toBeLessThan(-w / 2);
    expect(tetraRun(T.tetraTo, g, o).x).toBeCloseTo(0, 6);
    expect(tetraRun(T.tetraTo, g, o).speed).toBeLessThan(0.5);
    let last = -Infinity;
    for (let l = T.tetraFrom; l <= T.tetraTo; l += 0.005) {
      const x = tetraRun(l, g, o).x;
      expect(x).toBeGreaterThanOrEqual(last - 1e-9);
      last = x;
    }
  });

  it("hands her from the run to the stand with no step", () => {
    const run = { x: 0, y: 0, speed: 0, running: false };
    const stand = { x: 0, y: 0, height: 0 };
    tetraRun(T.tetraTo, g, run);
    tetraStand(T.tetraTo, g, stand);
    expect(stand.x).toBeCloseTo(run.x, 6);
    expect(stand.y).toBeCloseTo(run.y, 6);
    expect(stand.height).toBeCloseTo(g.tetraH, 6);
  });

  it("zooms to her reading height, low and in the middle, and keeps it", () => {
    const stand = { x: 0, y: 0, height: 0 };
    tetraStand(1, g, stand);
    expect(stand.x).toBe(0);
    expect(stand.height).toBeCloseTo(g.zoomH, 6);
    expect(stand.y).toBeCloseTo(g.zoomFeet, 6);
    expect(stand.height).toBeGreaterThan(1.4 * g.tetraH);
    expect(zoomAt(0.5)).toBe(0);
    expect(zoomAt(0.9)).toBe(1);
  });
});

describe("the beats and the words", () => {
  it("runs, pants, waves, sits and reads, in that order and never back", () => {
    const order = ["run", "pant", "wave", "sit", "read"];
    let at = 0;
    for (let l = 0; l <= 1; l += 0.005) {
      const i = order.indexOf(beatAt(l));
      expect(i).toBeGreaterThanOrEqual(at);
      at = i;
    }
    expect(beatAt(0.2)).toBe("run");
    expect(beatAt(1)).toBe("read");
  });

  it("shows the words in, holds them and takes them away before the end", () => {
    expect(wordsAmount(0)).toBe(0);
    expect(wordsAmount(T.wordsFrom - 0.01)).toBe(0);
    expect(wordsAmount((T.wordsTo + T.wordsOutFrom) / 2)).toBe(1);
    expect(wordsAmount(1)).toBe(0);
    expect(wordsAmount(0.97)).toBeGreaterThan(0);
    expect(wordsAmount(0.97)).toBeLessThan(0.5);
  });
});
