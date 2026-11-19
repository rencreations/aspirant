import { describe, expect, it } from "vitest";

import { alongAtRest, arrangePictures, MIN_GAP, type PoolKey } from "./arrange";
import { wallGrid } from "./grid";
import { poolOf, setDef } from "./sets";

const SIZES = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 1920, h: 1080 },
  { w: 390, h: 844 },
] as const;

/** The characters of the shipped pool, in its order (a one-character picture, else null). */
function shippedKeys(): PoolKey[] {
  return poolOf(setDef("hero")).map((p) => (p.chars.length === 1 ? p.chars[0]! : null));
}

/** A pool of `n` pictures cycling through ten Aspirants, a third of them group pictures. */
function fakeKeys(n: number): PoolKey[] {
  return Array.from({ length: n }, (_, i) => (i % 3 === 2 ? null : `c${(i * 7) % 10}`));
}

function rowsOf(pics: Int32Array, g: ReturnType<typeof wallGrid>["geom"]): number[][] {
  const rows: number[][] = g.rowCount.map(() => []);
  for (let s = 0; s < g.n; s++) rows[g.slotRow[s]!]!.push(pics[s]!);
  return rows;
}

describe("arrangePictures on the shipped pool", () => {
  const def = setDef("hero");
  const keys = shippedKeys();
  const groups = poolOf(def).map((p) => p.group ?? null);

  it("has more than a hundred different pictures, and one group key for each tile", () => {
    expect(keys.length).toBeGreaterThanOrEqual(100);
    expect(groups.filter((g) => g !== null).length).toBe(def.tiles.length);
  });

  for (const vp of SIZES) {
    it(`${vp.w}x${vp.h}: shows every cell a different picture and keeps look-alikes out of a row and its neighbour`, () => {
      const { geom } = wallGrid(vp);
      const pics = arrangePictures(geom, keys, alongAtRest(geom), 1, groups);
      expect(new Set(pics).size).toBe(geom.n);
      const rows = rowsOf(pics, geom);
      rows.forEach((row, r) => {
        const own = new Set<string>();
        for (const p of row) {
          const g = groups[p];
          if (g === null || g === undefined) continue;
          expect(own.has(g), `row ${r} twice shows group ${g}`).toBe(false);
          own.add(g);
        }
        const next = rows[r + 1];
        if (next) {
          for (const p of next) {
            const g = groups[p];
            if (g !== null && g !== undefined)
              expect(own.has(g), `rows ${r} and ${r + 1} share ${g}`).toBe(false);
          }
        }
      });
    });
  }
});

describe("arrangePictures", () => {
  for (const [name, keys] of [
    ["the shipped pool", shippedKeys()],
    ["a pool of 120", fakeKeys(120)],
    ["a pool of 40", fakeKeys(40)],
  ] as const) {
    for (const vp of SIZES) {
      const { geom } = wallGrid(vp);
      const pics = arrangePictures(geom, keys, alongAtRest(geom));
      const rows = rowsOf(pics, geom);

      it(`${name}, ${vp.w}x${vp.h}: no picture twice in a row`, () => {
        rows.forEach((row) => expect(new Set(row).size).toBe(row.length));
      });

      it(`${name}, ${vp.w}x${vp.h}: two rows next to each other share no picture`, () => {
        for (let r = 0; r + 1 < rows.length; r++) {
          const a = new Set(rows[r]);
          expect(
            rows[r + 1]!.some((p) => a.has(p)),
            `rows ${r} and ${r + 1}`,
          ).toBe(false);
        }
      });

      it(`${name}, ${vp.w}x${vp.h}: an Aspirant is never next to herself in a row, seam included`, () => {
        for (const row of rows) {
          for (let c = 0; c < row.length; c++) {
            const a = keys[row[c]!]!;
            const b = keys[row[(c + 1) % row.length]!]!;
            if (a !== null && row.length > 2) expect(a).not.toBe(b);
          }
        }
      });

      it(`${name}, ${vp.w}x${vp.h}: the same picture waits ${MIN_GAP} places while the pool lasts`, () => {
        const pool = keys.length;
        const seen = new Map<number, number>();
        for (let s = 0; s < geom.n; s++) {
          const p = pics[s]!;
          const at = seen.get(p);
          // Only a pool that cannot fill the plane has to repeat; then it repeats the longest ago.
          if (at !== undefined && pool >= geom.n) expect(s - at).toBeGreaterThanOrEqual(MIN_GAP);
          seen.set(p, s);
        }
        if (pool >= geom.n) expect(seen.size).toBe(geom.n);
      });
    }
  }

  it("a pool smaller than the plane repeats the picture shown longest ago", () => {
    const { geom } = wallGrid({ w: 1440, h: 900 });
    const keys = fakeKeys(40);
    const pics = arrangePictures(geom, keys, alongAtRest(geom));
    const last = new Map<number, number>();
    let shortest = Infinity;
    for (let s = 0; s < geom.n; s++) {
      const p = pics[s]!;
      const at = last.get(p);
      if (at !== undefined) shortest = Math.min(shortest, s - at);
      last.set(p, s);
    }
    // 40 pictures over about 74 slots: nothing repeats inside half a pool.
    expect(shortest).toBeGreaterThanOrEqual(20);
  });

  it("is the same on every call (no random state)", () => {
    const { geom } = wallGrid({ w: 1440, h: 900 });
    const keys = fakeKeys(70);
    const a = arrangePictures(geom, keys, alongAtRest(geom));
    const b = arrangePictures(geom, keys, alongAtRest(geom));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("a pool of one picture gives picture 0 everywhere", () => {
    const { geom } = wallGrid({ w: 1440, h: 900 });
    expect(arrangePictures(geom, [null], alongAtRest(geom)).every((p) => p === 0)).toBe(true);
  });
});
