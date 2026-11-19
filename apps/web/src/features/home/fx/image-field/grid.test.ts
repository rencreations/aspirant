import { describe, expect, it } from "vitest";

import { planeToScreen, screenToPlane, slotPicture, wallGrid } from "./grid";
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

  it("has many small cards: six to nine rows cross a wide wall", () => {
    const { geom, wall } = wallGrid({ w: 1440, h: 900 });
    expect(geom.cardH).toBeLessThan(0.2 * wall.h);
    // The rows whose cards sit in the wall's frame.
    const rows = new Set<number>();
    const { inFrame } = wallGrid({ w: 1440, h: 900 });
    for (let s = 0; s < geom.n; s++) if (inFrame[s]) rows.add(geom.slotRow[s]!);
    expect(rows.size).toBeGreaterThanOrEqual(6);
    expect(rows.size).toBeLessThanOrEqual(16);
  });

  it("has more slots in the wall's frame than the hero's eighteen cards", () => {
    for (const vp of SIZES) {
      const { inFrame } = wallGrid(vp);
      const count = inFrame.reduce((a, b) => a + b, 0);
      expect(count, `${vp.w}x${vp.h}`).toBeGreaterThanOrEqual(18);
    }
  });
});

describe("the picture of a slot", () => {
  it("never shows the same picture twice side by side in a row, or in two rows next to each other", () => {
    for (const pool of [18, 30, 49, 78]) {
      const { geom } = wallGrid({ w: 1440, h: 900 });
      const byRow: number[][] = geom.rowCount.map((c) => Array.from({ length: c }, () => -1));
      for (let s = 0; s < geom.n; s++) {
        byRow[geom.slotRow[s]!]![geom.slotCol[s]!] = slotPicture(geom, s, pool);
      }
      byRow.forEach((row, r) => {
        for (let c = 1; c < row.length; c++) expect(row[c]).not.toBe(row[c - 1]);
        const next = byRow[r + 1];
        if (next) {
          const a = new Set(row);
          expect(next.some((p) => a.has(p))).toBe(false);
        }
      });
    }
  });

  it("uses every picture of the pool", () => {
    const { geom } = wallGrid({ w: 1440, h: 900 });
    const seen = new Set<number>();
    for (let s = 0; s < geom.n; s++) seen.add(slotPicture(geom, s, 18));
    expect(seen.size).toBe(18);
  });
});
