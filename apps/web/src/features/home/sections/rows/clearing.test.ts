import { describe, expect, it } from "vitest";

import { planeToScreen, wallGrid } from "../../fx/image-field/grid";
import { makePose } from "../../fx/image-field/types";
import { rowWay, slotPlane, wallSlotPose, type WallGeom } from "../../fx/image-field/wall";
import { WINDOW_ASPECT } from "../../fx/video-plane/layout";
import { STORY } from "../story";

import { clearingReach, gapPush, rowsPose, spacedU, visibleReach, type RowsPlay } from "./clearing";
import { ANGLE_SIZE, ROWS_BEATS, appearAt, clearAt, gapAt, slideShape } from "./journey";
import { makeRide, planRide } from "./slide";
import { ROWS_ZONE } from "./zone";

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
 * For the whole of the transition up to the clearing, from many starting scroll positions, the film's
 * rect (its place along the middle row, its size as `heroBase` makes it: as big as a card) and every
 * card's rect (after the space) do not meet. The slide is the scroll's, so any start is possible.
 */
describe("the film never touches a picture", () => {
  function worstClearance(zoneStart: number): number {
    const ride = planRide(geom, vp, zoneStart, ROWS_ZONE, STORY.rows.length, makeRide());
    let worst = Infinity;
    const o: [number, number] = [0, 0];
    for (let s = 0; s <= ROWS_BEATS.clear[0]; s += 0.01) {
      const a = appearAt(s);
      if (a <= 0.001) continue;
      const along = slideShape(s, ride.slope);
      const slide = ride.phase0 + ride.ride * along;
      const filmU = ride.startU * (1 - along);
      const p = play({ filmU, gap: gapAt(s), clear: clearAt(s) });
      // The film as heroBase draws it: a card's width, 16 to 9, in the plane's own pixels.
      const hw = (geom.cardW * ANGLE_SIZE) / 2;
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

  it("keeps a clear margin from every card through the opening and the ride, from any scroll position", () => {
    for (const zoneStart of [0, 0.37, 1.6, 2, 3.917, 5.55, 12.4]) {
      // Positive: a clear space between the film and the nearest card, along the row or across it.
      expect(worstClearance(zoneStart), `zone at ${zoneStart}`).toBeGreaterThan(0);
    }
  });

  it("has the film as wide as a picture", () => {
    expect(ANGLE_SIZE).toBe(1);
  });

  it("leaves the space the row's own gap wide: the film is one more place of the row", () => {
    expect(gapPush(geom)).toBeCloseTo(geom.pitch / 2, 9);
  });

  it("rides along the middle row's way", () => {
    expect(Math.abs(rowWay(geom.midRow))).toBe(1);
  });
});

describe("the clearing", () => {
  it("takes the cards along their own rows, never across them", () => {
    const filmU = 0;
    const reach = visibleReach(geom, vp.w, vp.h, filmU);
    const p = play({ filmU, gap: 1, clear: 0.6, reach });
    for (let slot = 0; slot < geom.n; slot += 3) {
      const a = makePose();
      const b = makePose();
      rowsPose(geom, slot, 321, play({ filmU, gap: 1 }), a);
      rowsPose(geom, slot, 321, p, b);
      // The move between the two poses is along the plane's row axis only.
      const d = [b.x - a.x, b.y - a.y, b.z - a.z];
      const along = d[0]! * geom.right[0] + d[1]! * geom.right[1] + d[2]! * geom.right[2];
      const across = d[0]! * geom.up[0] + d[1]! * geom.up[1] + d[2]! * geom.up[2];
      expect(Math.abs(across)).toBeLessThan(1e-6);
      expect(Math.abs(along)).toBeLessThanOrEqual(1.8 * geom.cardW + 1e-6);
    }
  });

  it("has taken every card that can be seen by the end, and a good share of the screen not before the middle", () => {
    const filmU = 0;
    const reach = visibleReach(geom, vp.w, vp.h, filmU);
    // The reach is the screen's, not the whole plane's.
    expect(reach).toBeLessThan(clearingReach(geom, filmU));
    for (let slot = 0; slot < geom.n; slot++) {
      const out = makePose();
      rowsPose(geom, slot, 700, play({ filmU, gap: 1, clear: 1, reach }), out);
      const o: [number, number] = [0, 0];
      slotPlane(geom, slot, 700, o);
      const xy: [number, number] = [0, 0];
      planeToScreen(geom, o[0], o[1], xy);
      const seen = Math.abs(xy[0]) <= vp.w / 2 + 40 && Math.abs(xy[1]) <= vp.h / 2 + 40;
      if (seen) expect(out.opacity).toBe(0);
    }
    // Half way through the clearing the cards of the screen are still mostly there: it is not over in the first third.
    let there = 0;
    let seenCount = 0;
    for (let slot = 0; slot < geom.n; slot++) {
      const o: [number, number] = [0, 0];
      slotPlane(geom, slot, 700, o);
      const xy: [number, number] = [0, 0];
      planeToScreen(geom, o[0], o[1], xy);
      if (Math.abs(xy[0]) > vp.w / 2 || Math.abs(xy[1]) > vp.h / 2) continue;
      seenCount += 1;
      const out = makePose();
      rowsPose(geom, slot, 700, play({ filmU, gap: 1, clear: 0.4, reach }), out);
      if (out.opacity > 0.5) there += 1;
    }
    expect(there / seenCount).toBeGreaterThan(0.3);
  });
});
