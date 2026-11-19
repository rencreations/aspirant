import { describe, expect, it } from "vitest";

import { wallGrid } from "../../fx/image-field/grid";
import { SLIDE_ORIGIN } from "../../fx/image-field/scroll-slide";
import { rowWay } from "../../fx/image-field/wall";
import { STORY } from "../story";

import { ROWS_BEATS, slideShape } from "./journey";
import { SLIDE_PITCHES_PER_SCREEN, makeRide, planRide, scrollSlide } from "./slide";
import { ROWS_DWELL, ROWS_REST, ROWS_SCREENS, ROWS_ZONE } from "./zone";

const sizes = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];
const ZONE_START = 1.6 + ROWS_DWELL;

describe("the zone", () => {
  it("is a dwell and a transition that make the section", () => {
    expect(ROWS_SCREENS).toBeCloseTo(ROWS_DWELL + ROWS_ZONE + ROWS_REST, 12);
    // The zone ends before the strip's lead (0.3) begins, so the two never both drive the film mid way.
    expect(ROWS_REST).toBeGreaterThanOrEqual(0.3);
    // The owner wants it short: about a screen and a bit.
    expect(ROWS_ZONE).toBeGreaterThanOrEqual(0.8);
    expect(ROWS_ZONE).toBeLessThanOrEqual(1.5);
  });
});

describe("the slide", () => {
  it("follows the scroll in both directions: the same scroll is the same slide", () => {
    const g = wallGrid(sizes[0]!).geom;
    // The plane stands still until the wall has landed, then slides with the scroll.
    expect(scrollSlide(g, 0)).toBe(0);
    expect(scrollSlide(g, SLIDE_ORIGIN)).toBe(0);
    expect(scrollSlide(g, SLIDE_ORIGIN + 2)).toBeCloseTo(2 * SLIDE_PITCHES_PER_SCREEN * g.pitch, 9);
    expect(scrollSlide(g, SLIDE_ORIGIN + 1.3)).toBe(scrollSlide(g, SLIDE_ORIGIN + 1.3));
    expect(scrollSlide(g, SLIDE_ORIGIN + 1.3) - scrollSlide(g, SLIDE_ORIGIN + 1.2)).toBeCloseTo(
      0.1 * SLIDE_PITCHES_PER_SCREEN * g.pitch,
      9,
    );
  });

  it("is planned from the scroll alone: the same zone gives the same ride every time", () => {
    for (const vp of sizes) {
      const g = wallGrid(vp).geom;
      const a = planRide(g, vp, ZONE_START, ROWS_ZONE, STORY.rows.length, makeRide());
      const b = planRide(g, vp, ZONE_START, ROWS_ZONE, STORY.rows.length, makeRide());
      expect(a).toEqual(b);
    }
  });

  it("starts the transition with the slope the scroll gave the rows, inside the cubic's monotone range", () => {
    for (const vp of sizes) {
      const g = wallGrid(vp).geom;
      for (const start of [0.5, 1.7, 2.0, 5.55]) {
        const r = planRide(g, vp, start, ROWS_ZONE, STORY.rows.length, makeRide());
        expect(r.slope).toBeGreaterThan(0);
        expect(r.slope).toBeLessThanOrEqual(2.5 + 1e-9);
        // The slide's own speed at the start of the zone, per screen of scroll, equals the scroll's:
        // d(slide)/d(scroll) = ride * slope / (the scroll the slide beat spans).
        const slideScroll = (ROWS_BEATS.slide[1] / STORY.rows.length) * ROWS_ZONE;
        expect((r.ride * r.slope) / slideScroll).toBeCloseTo(SLIDE_PITCHES_PER_SCREEN * g.pitch, 6);
        // The film starts on the side the row comes from.
        expect(Math.sign(r.startU)).toBe(-rowWay(g.midRow));
        // The slide never goes back while it comes to rest.
        let last = r.phase0;
        for (let s = 0; s <= ROWS_BEATS.slide[1]; s += 0.01) {
          const slide = r.phase0 + r.ride * slideShape(s, r.slope);
          expect(slide).toBeGreaterThanOrEqual(last - 1e-9);
          last = slide;
        }
        expect(r.phase0 + r.ride * slideShape(ROWS_BEATS.slide[1], r.slope)).toBeCloseTo(
          r.phase0 + r.ride,
          6,
        );
        expect(last).toBeGreaterThan(r.phase0);
      }
    }
  });
});
