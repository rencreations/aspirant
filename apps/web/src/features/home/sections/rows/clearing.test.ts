import { describe, expect, it } from "vitest";

import { wallGrid } from "../../fx/image-field/grid";
import { makePose } from "../../fx/image-field/types";
import { rowWay, slotPlane, wallSlotPose, type WallGeom } from "../../fx/image-field/wall";
import { WINDOW_ASPECT } from "../../fx/video-plane/layout";

import { clearingReach, gapPush, rowsPose, spacedU, type RowsPlay } from "./clearing";
import {
  ANGLE_SIZE,
  ROWS_BEATS,
  appearAt,
  clearAt,
  filmStartU,
  gapAt,
  rideDistance,
  rideReach,
  slideShape,
} from "./journey";

const vp = { w: 1440, h: 900 };
const geom: WallGeom = wallGrid(vp).geom;

const play = (over: Partial<RowsPlay> = {}): RowsPlay => ({
  filmU: 0,
  gap: 0,
  clear: 0,
  reach: 0,
  ...over,
});

describe("rowsPose", () => {
  it("is the field's own pose until the space opens or the clearing starts", () => {
    for (const slide of [0, 1234.5, -800]) {
      for (let slot = 0; slot < geom.n; slot += 7) {
        const a = makePose();
        const b = makePose();
        wallSlotPose(geom, slot, slide, a);
        rowsPose(geom, slot, slide, play(), b);
        expect(b).toEqual(a);
      }
    }
  });

  it("moves only the middle row's cards when the space opens, and by the same push on either side", () => {
    const push = gapPush(geom);
    const slide = 345;
    const filmU = 50;
    const p = play({ filmU, gap: 1 });
    let left = 0;
    let right = 0;
    for (let slot = 0; slot < geom.n; slot++) {
      const row = geom.slotRow[slot]!;
      const u0 = (() => {
        const o: [number, number] = [0, 0];
        slotPlane(geom, slot, slide, o);
        return o[0];
      })();
      const u1 = spacedU(geom, slot, slide, p);
      if (row !== geom.midRow) {
        expect(u1).toBe(u0);
        continue;
      }
      const moved = u1 - u0;
      expect(Math.abs(Math.abs(moved) - push)).toBeLessThan(1e-9);
      if (moved < 0) left += 1;
      else right += 1;
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });

  it("leaves no card behind at the end of the clearing", () => {
    for (const filmU of [0, 400, -900]) {
      const p = play({ filmU, gap: 1, clear: 1, reach: clearingReach(geom, filmU) });
      for (let slot = 0; slot < geom.n; slot++) {
        const out = makePose();
        rowsPose(geom, slot, 700, p, out);
        expect(out.opacity).toBe(0);
      }
    }
  });

  it("takes the cards nearest the film first", () => {
    const filmU = 0;
    const reach = clearingReach(geom, filmU);
    const p = play({ filmU, gap: 1, clear: 0.35, reach });
    const near: number[] = [];
    const far: number[] = [];
    for (let slot = 0; slot < geom.n; slot++) {
      const o: [number, number] = [0, 0];
      slotPlane(geom, slot, 0, o);
      const out = makePose();
      rowsPose(geom, slot, 0, p, out);
      (Math.hypot(o[0], o[1]) < 400 ? near : far).push(out.opacity);
    }
    expect(Math.min(...far)).toBeGreaterThanOrEqual(Math.max(Math.min(...near), 0));
    expect(Math.min(...near)).toBeLessThan(1);
  });
});

/**
 * The film is on the same plane as the cards, so no overlap on the plane is no overlap on the screen.
 * For the whole of the play up to the clearing, at many starting phases and speeds, the film's rect
 * (its place along the middle row, its size as `heroBase` makes it) and every card's rect (after the
 * space) do not meet.
 */
describe("the film never touches a picture", () => {
  const T = 3;
  const SLIDE_SECONDS = T * (ROWS_BEATS.slide[1] / 2.4);

  function worstClearance(slide0: number, speed: number): number {
    const reach = rideReach(geom, vp.w);
    const ride = rideDistance(geom, slide0, speed, reach, SLIDE_SECONDS);
    const slope = (speed * SLIDE_SECONDS) / ride;
    const startU = filmStartU(geom, ride);
    let worst = Infinity;
    const o: [number, number] = [0, 0];
    for (let s = 0; s <= ROWS_BEATS.clear[0]; s += 0.02) {
      const a = appearAt(s);
      if (a <= 0.001) continue;
      const along = slideShape(s, slope);
      const slide = slide0 + ride * along;
      const filmU = startU * (1 - along);
      const p = play({ filmU, gap: gapAt(s), clear: clearAt(s) });
      // The film as heroBase draws it: the card's width times the grow, in the plane's own pixels.
      const grow = (0.6 + 0.4 * (a * a * (3 - 2 * a))) * ANGLE_SIZE;
      const hw = (geom.cardW * grow) / 2;
      const hh = hw / WINDOW_ASPECT;
      for (let slot = 0; slot < geom.n; slot++) {
        if (
          geom.slotRow[slot] !== geom.midRow &&
          Math.abs(geom.rowV[geom.slotRow[slot]!]!) > geom.rise * 1.01
        ) {
          continue;
        }
        slotPlane(geom, slot, slide, o);
        const u = spacedU(geom, slot, slide, p);
        const gapU = Math.abs(u - filmU) - (geom.cardW / 2 + hw);
        const gapV = Math.abs(o[1]) - (geom.cardH / 2 + hh);
        worst = Math.min(worst, Math.max(gapU, gapV));
      }
    }
    return worst;
  }

  it("keeps a clear margin from every card through the opening and the ride, from any phase and speed", () => {
    const phases = [0, 17.3, 120, 333.3, 777, 4321.1, -250];
    for (const slide0 of phases) {
      for (const speed of [0, 80, 400, 900, 1500]) {
        // Positive: a clear space between the film and the nearest card, along the row or across it.
        expect(worstClearance(slide0, speed), `slide ${slide0} speed ${speed}`).toBeGreaterThan(0);
      }
    }
  });

  it("rides along the middle row's way", () => {
    expect(Math.abs(rowWay(geom.midRow))).toBe(1);
  });
});
