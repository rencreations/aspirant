import { describe, expect, it } from "vitest";

import { wallGrid } from "../../fx/image-field/grid";
import { SLIDE_EASE_END, SLIDE_ORIGIN } from "../../fx/image-field/scroll-slide";
import { rowWay } from "../../fx/image-field/wall";
import { sectionEnd, sectionStart } from "../../kernel/where";
import { STORY } from "../story";

import { ROWS_BEATS, slideShape } from "./journey";
import { SLIDE_PITCHES, makeRide, planRide, scrollSlide, scrollSlideSpeed } from "./slide";
import { ROWS_DWELL, ROWS_REST, ROWS_SCREENS, ROWS_ZONE } from "./zone";

const sizes = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];
const ZONE_START = SLIDE_EASE_END;

describe("the zone", () => {
  it("is a dwell and a transition that make the section", () => {
    expect(ROWS_SCREENS).toBeCloseTo(ROWS_DWELL + ROWS_ZONE + ROWS_REST, 12);
    // The zone ends before the strip's lead (0.3) begins, so the two never both drive the film mid way.
    expect(ROWS_REST).toBeGreaterThanOrEqual(0.3);
    // The owner wants it short: about a screen and a bit.
    expect(ROWS_ZONE).toBeGreaterThanOrEqual(0.8);
    expect(ROWS_ZONE).toBeLessThanOrEqual(1.5);
  });

  it("starts where the eased slide hands over to the zone's cubic, and the wall joins the rows there", () => {
    expect(SLIDE_EASE_END).toBeCloseTo(sectionStart("rows") + ROWS_DWELL, 9);
    // The wall's section ends where the rows' dwell begins: one function of the scroll serves both.
    expect(sectionEnd("aspirants")).toBeCloseTo(sectionStart("rows"), 9);
  });

  it("has no step of speed at the joint of the wall and the rows", () => {
    for (const vp of sizes) {
      const g = wallGrid(vp).geom;
      const joint = sectionStart("rows");
      const eps = 1e-4;
      const left = (scrollSlide(g, joint) - scrollSlide(g, joint - eps)) / eps;
      const right = (scrollSlide(g, joint + eps) - scrollSlide(g, joint)) / eps;
      expect(Math.abs(right - left) / left).toBeLessThan(1e-2);
    }
  });
});

describe("the slide", () => {
  it("is eased in by the scroll in both directions: the same scroll is the same slide", () => {
    const g = wallGrid(sizes[0]!).geom;
    // The plane stands still until the wall has landed, then gains speed with the scroll.
    expect(scrollSlide(g, 0)).toBe(0);
    expect(scrollSlide(g, SLIDE_ORIGIN)).toBe(0);
    expect(scrollSlide(g, SLIDE_EASE_END)).toBeCloseTo(SLIDE_PITCHES * g.pitch, 9);
    expect(scrollSlide(g, SLIDE_ORIGIN + 1.3)).toBe(scrollSlide(g, SLIDE_ORIGIN + 1.3));
    // No speed at the origin, and a speed that grows from nothing just past it (zero speed at the start).
    expect(scrollSlideSpeed(g, SLIDE_ORIGIN)).toBe(0);
    const eps = 1e-3;
    expect((scrollSlide(g, SLIDE_ORIGIN + eps) - scrollSlide(g, SLIDE_ORIGIN)) / eps).toBeLessThan(
      0.01 * scrollSlideSpeed(g, SLIDE_EASE_END),
    );
    // The speed only grows up to the end of the ease in.
    let speed = 0;
    for (let S = SLIDE_ORIGIN; S <= SLIDE_EASE_END; S += 0.05) {
      expect(scrollSlideSpeed(g, S)).toBeGreaterThanOrEqual(speed);
      speed = scrollSlideSpeed(g, S);
    }
    // The first screen of scroll moves less than the last one before the transition (ease in).
    const first = scrollSlide(g, SLIDE_ORIGIN + 1) - scrollSlide(g, SLIDE_ORIGIN);
    const last = scrollSlide(g, SLIDE_EASE_END) - scrollSlide(g, SLIDE_EASE_END - 1);
    expect(first).toBeLessThan(last / 3);
  });

  it("takes the zone over at the speed the ease in arrives with, and ends at rest", () => {
    for (const vp of sizes) {
      const g = wallGrid(vp).geom;
      const r = planRide(g, vp, ZONE_START, ROWS_ZONE, STORY.rows.length, makeRide());
      const slideScroll = (ROWS_BEATS.slide[1] / STORY.rows.length) * ROWS_ZONE;
      const at = (S: number): number => {
        const s = ((S - ZONE_START) / ROWS_ZONE) * STORY.rows.length;
        return S < ZONE_START ? scrollSlide(g, S) : r.phase0 + r.ride * slideShape(s, r.slope);
      };
      const eps = 1e-5;
      // Continuous in position and in speed across the zone's start.
      expect(at(ZONE_START)).toBeCloseTo(scrollSlide(g, ZONE_START), 6);
      const before = (at(ZONE_START) - at(ZONE_START - eps)) / eps;
      const after = (at(ZONE_START + eps) - at(ZONE_START)) / eps;
      expect(before).toBeCloseTo(scrollSlideSpeed(g, ZONE_START), 0);
      expect(Math.abs(after - before) / before).toBeLessThan(1e-3);
      // At rest where the slide beat ends.
      const rest = ZONE_START + slideScroll;
      expect((at(rest) - at(rest - eps)) / eps).toBeLessThan(0.001 * before);
      // Monotone from the origin to the rest: the wall and the rows never reverse.
      let last = 0;
      for (let S = 0; S <= rest + 0.5; S += 0.01) {
        const x = S > rest ? at(rest) : at(S);
        expect(x).toBeGreaterThanOrEqual(last - 1e-6);
        last = x;
      }
    }
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
      for (const start of [3.5, 4.5, SLIDE_EASE_END, 5.6]) {
        const r = planRide(g, vp, start, ROWS_ZONE, STORY.rows.length, makeRide());
        expect(r.slope).toBeGreaterThan(0);
        expect(r.slope).toBeLessThanOrEqual(2.5 + 1e-9);
        // The slide's own speed at the start of the zone, per screen of scroll, equals the scroll's:
        // d(slide)/d(scroll) = ride * slope / (the scroll the slide beat spans).
        const slideScroll = (ROWS_BEATS.slide[1] / STORY.rows.length) * ROWS_ZONE;
        expect((r.ride * r.slope) / slideScroll).toBeCloseTo(scrollSlideSpeed(g, start, start), 6);
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
