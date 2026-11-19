import { describe, expect, it } from "vitest";

import { planeToScreen, screenToPlane, wallGrid } from "./grid";
import { slotPlane } from "./wall";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
  { w: 1920, h: 1080 },
  { w: 768, h: 1024 },
];

describe("the wall's plane", () => {
  it("has an odd middle row through v = 0", () => {
    for (const vp of SIZES) {
      const { geom } = wallGrid(vp);
      expect(geom.midRow).toBeGreaterThanOrEqual(0);
      expect(geom.rowV[geom.midRow]).toBeCloseTo(0, 6);
    }
  });

  it("maps the screen to the plane and back", () => {
    const { geom } = wallGrid({ w: 1440, h: 900 });
    const uv: [number, number] = [0, 0];
    const xy: [number, number] = [0, 0];
    for (const [X, Y] of [
      [0, 0],
      [500, 300],
      [-700, -400],
      [300, -440],
    ] as const) {
      screenToPlane(geom.right, geom.up, 2000, X, Y, uv);
      planeToScreen(geom, uv[0], uv[1], xy);
      expect(xy[0]).toBeCloseTo(X, 3);
      expect(xy[1]).toBeCloseTo(Y, 3);
    }
  });

  it("covers every point of the screen, whatever the slide", () => {
    for (const vp of SIZES) {
      const { geom } = wallGrid(vp);
      const uv: [number, number] = [0, 0];
      const place: [number, number] = [0, 0];
      // Cards by row at a slide: their centres along u.
      for (const slide of [0, 111, 937, 4096.5, 123456.789]) {
        const centres: number[][] = geom.rowCount.map(() => []);
        for (let s = 0; s < geom.n; s++) {
          slotPlane(geom, s, slide, place);
          centres[geom.slotRow[s]!]!.push(place[0]);
        }
        let missed = 0;
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
          for (let j = 0; j <= steps; j++) {
            const X = (i / steps - 0.5) * vp.w;
            const Y = (j / steps - 0.5) * vp.h;
            screenToPlane(geom.right, geom.up, 2000, X, Y, uv);
            // The row whose v is nearest, then the nearest card centre in that row.
            let row = 0;
            for (let r = 1; r < geom.rows; r++) {
              if (Math.abs(geom.rowV[r]! - uv[1]) < Math.abs(geom.rowV[row]! - uv[1])) row = r;
            }
            const near = Math.min(...centres[row]!.map((u) => Math.abs(u - uv[0])));
            if (
              Math.abs(geom.rowV[row]! - uv[1]) > geom.rise / 2 + 1e-6 ||
              near > geom.pitch / 2 + 1e-6
            ) {
              missed += 1;
            }
          }
        }
        expect(missed, `${vp.w}x${vp.h} slide ${slide}`).toBe(0);
      }
    }
  });

  it("keeps the wrap seam outside the screen", () => {
    for (const vp of SIZES) {
      const { geom } = wallGrid(vp);
      const place: [number, number] = [0, 0];
      const xy: [number, number] = [0, 0];
      for (let s = 0; s < geom.n; s++) {
        const r = geom.slotRow[s]!;
        const count = geom.rowCount[r]!;
        const len = count * geom.pitch;
        const u0 = (geom.slotCol[s]! - (count - 1) / 2) * geom.pitch;
        const way = r % 2 === 0 ? 1 : -1;
        // The slides at which this card is just short of the wrap (it jumps next) and just past it.
        for (const eps of [-0.01, 0.01]) {
          const slide = way * (len / 2 - u0 + eps);
          slotPlane(geom, s, slide, place);
          // The card's four plane corners, on the screen: none may be inside it.
          let inside = false;
          for (const [du, dv] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
            [0, 0],
          ] as const) {
            planeToScreen(
              geom,
              place[0] + (du * geom.cardW) / 2,
              place[1] + (dv * geom.cardH) / 2,
              xy,
            );
            if (Math.abs(xy[0]) < vp.w / 2 && Math.abs(xy[1]) < vp.h / 2) inside = true;
          }
          expect(inside, `${vp.w}x${vp.h} slot ${s} eps ${eps}`).toBe(false);
        }
      }
    }
  });

  it("has big cards: a wall frame of about half the width shows five to nine rows", () => {
    const { geom, wall, inFrame } = wallGrid({ w: 1440, h: 900 });
    // Round three: big tilted pictures (the owner's premotio reference), not a mosaic.
    expect(geom.cardH).toBeGreaterThan(0.15 * wall.h);
    expect(wall.w / 1440).toBeCloseTo(0.5, 5);
    const rows = new Set<number>();
    for (let s = 0; s < geom.n; s++) if (inFrame[s]) rows.add(geom.slotRow[s]!);
    expect(rows.size).toBeGreaterThanOrEqual(5);
    expect(rows.size).toBeLessThanOrEqual(9);
  });

  it("has slots in the wall's frame for most of the hero's cards (the rest land at its edge)", () => {
    for (const vp of SIZES) {
      const { inFrame } = wallGrid(vp);
      const count = inFrame.reduce((a, b) => a + b, 0);
      expect(count, `${vp.w}x${vp.h}`).toBeGreaterThanOrEqual(8);
    }
  });
});
