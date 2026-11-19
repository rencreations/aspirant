import { describe, expect, it } from "vitest";

import { wallGrid } from "../../fx/image-field/grid";
import { rowWay } from "../../fx/image-field/wall";
import { STORY } from "../story";

import {
  appearAt,
  clearAt,
  clearRadius,
  filmAlong,
  filmStartU,
  gapAt,
  leaveOf,
  MIN_RIDE_PITCHES,
  morphAt,
  rideDistance,
  rideReach,
  ROWS_BEATS,
  slideShape,
} from "./journey";

// The rows' story is `STORY.rows` (`../story.ts`): the beats must end with it.
const ROWS_SCREENS = STORY.rows.length;

describe("the rows' beats", () => {
  it("is ordered: the space opens, then the film shows, the rows rest, the clearing, the morph", () => {
    const B = ROWS_BEATS;
    expect(B.gap[0]).toBe(B.slide[0]);
    // The film shows after the space has begun to open, never before.
    expect(B.appear[0]).toBeGreaterThan(B.gap[0]);
    // The space is wide enough before the film has grown to its size.
    expect(B.appear[1]).toBeGreaterThanOrEqual(B.gap[1]);
    expect(B.clear[0]).toBeGreaterThanOrEqual(B.appear[1]);
    expect(B.morph[0]).toBeGreaterThanOrEqual(B.clear[1]);
    expect(B.morph[1]).toBe(ROWS_SCREENS);
  });

  it("lets the rows come to rest before the clearing starts", () => {
    expect(ROWS_BEATS.slide[1]).toBeLessThanOrEqual(ROWS_BEATS.clear[0] + 0.5);
  });
});

describe("the slide", () => {
  it("starts at rest, ends at rest, and is monotone for any starting slope", () => {
    for (const a of [0, 0.5, 1.5, 2.5, 3]) {
      expect(slideShape(-1, a)).toBe(0);
      expect(slideShape(ROWS_BEATS.slide[0], a)).toBe(0);
      expect(slideShape(ROWS_BEATS.slide[1], a)).toBeCloseTo(1, 12);
      expect(slideShape(ROWS_SCREENS, a)).toBeCloseTo(1, 12);
      let last = 0;
      for (let s = 0; s <= ROWS_BEATS.slide[1]; s += 0.005) {
        const p = slideShape(s, a);
        expect(p).toBeGreaterThanOrEqual(last - 1e-12);
        last = p;
      }
    }
  });

  it("starts with the slope it is asked for (the speed the rows had) and ends with none", () => {
    const [from, to] = ROWS_BEATS.slide;
    const h = 1e-5;
    for (const a of [0, 1, 2.5]) {
      const start = (slideShape(from + h, a) - slideShape(from, a)) / (h / (to - from));
      const end = (slideShape(to, a) - slideShape(to - h, a)) / (h / (to - from));
      expect(start).toBeCloseTo(a, 3);
      expect(end).toBeCloseTo(0, 3);
    }
  });

  it("puts the film at the far end of its ride at the start and at the middle at the end", () => {
    expect(filmAlong(0)).toBe(1);
    expect(filmAlong(ROWS_BEATS.slide[1])).toBeCloseTo(0, 12);
    expect(filmAlong(0, 2)).toBe(1);
  });
});

describe("the other beats", () => {
  it("rise from 0 to 1 and rest outside", () => {
    for (const f of [gapAt, appearAt, clearAt, morphAt]) {
      expect(f(-1)).toBe(0);
      expect(f(ROWS_SCREENS)).toBe(1);
      let last = 0;
      for (let s = 0; s <= ROWS_SCREENS; s += 0.01) {
        const p = f(s);
        expect(p).toBeGreaterThanOrEqual(last - 1e-12);
        last = p;
      }
    }
  });

  it("clears the nearest card first and everything at the end", () => {
    const max = 1000;
    const feather = 200;
    expect(clearRadius(0, max, feather)).toBe(0);
    expect(clearRadius(1, max, feather)).toBe(max + feather);
    expect(leaveOf(300, 100, feather)).toBeGreaterThan(leaveOf(300, 250, feather));
    expect(leaveOf(max + feather, max, feather)).toBe(1);
    expect(leaveOf(0, 10, feather)).toBe(0);
  });
});

describe("the ride", () => {
  const sizes = [
    { w: 1440, h: 900 },
    { w: 1706, h: 950 },
    { w: 390, h: 844 },
  ];

  it("puts the space between two cards of the middle row, whatever the rows' phase", () => {
    for (const vp of sizes) {
      const g = wallGrid(vp).geom;
      const r = g.midRow;
      const way = rowWay(r);
      const count = g.rowCount[r]!;
      const grid0 = g.rowCenter[r]! - ((count - 1) / 2) * g.pitch;
      for (const slide of [0, 13.7, 500, 99999.5, -420]) {
        for (const speed of [0, 80, 700, 1500]) {
          const ride = rideDistance(g, slide, speed, rideReach(g, vp.w), 1.9);
          // The film's place in the row's own frame, from the grid: half a pitch off a card.
          const f0 = -way * (slide + ride);
          const off = (((f0 - grid0) % g.pitch) + g.pitch) % g.pitch;
          expect(Math.abs(off - g.pitch / 2), `${vp.w} slide ${slide} speed ${speed}`).toBeLessThan(
            1e-6,
          );
        }
      }
    }
  });

  it("is long enough: the least pitches, the reach, and steep enough for the speed it starts at", () => {
    for (const vp of sizes) {
      const g = wallGrid(vp).geom;
      for (const speed of [0, 400, 1500]) {
        const ride = rideDistance(g, 321, speed, rideReach(g, vp.w), 1.9);
        expect(ride).toBeGreaterThanOrEqual(MIN_RIDE_PITCHES * g.pitch - 1e-6);
        expect(ride).toBeGreaterThanOrEqual(rideReach(g, vp.w) - 1e-6);
        // The slide's slope a = speed * T / ride stays inside the cubic's monotone range.
        expect((speed * 1.9) / ride).toBeLessThanOrEqual(2.5 + 1e-9);
      }
    }
  });

  it("starts the film out on the side the row comes from, and ends it at the middle", () => {
    const g = wallGrid({ w: 1440, h: 900 }).geom;
    const start = filmStartU(g, 900);
    expect(Math.sign(start)).toBe(-rowWay(g.midRow));
    expect(start + rowWay(g.midRow) * 900).toBeCloseTo(0, 9);
  });
});
