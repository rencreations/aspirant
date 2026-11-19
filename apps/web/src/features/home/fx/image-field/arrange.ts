/**
 * Which picture each slot of the wall's plane shows (round three, 20 Nov 2026). Pure: no three.js, no DOM.
 *
 * The owner's rules: no picture twice in a row, none next to itself in any direction (the rows above and
 * below), a gap of several places before the same picture or the same Aspirant shows again, and when the
 * pool has run out the picture that repeats is the one that was shown longest ago. The rows slide in
 * opposite directions, so the cards of two neighbouring rows meet at every offset: the only guarantee
 * that holds at all of them is that two neighbouring rows share no picture and no Aspirant at all (the
 * "near" test below), and that inside a row, wrap seam included, no picture and no Aspirant is next to
 * its own, and so are two pictures of one group (a scene or shot that looks alike: `groups`). The wider rule (an Aspirant near the same Aspirant two rows away) is kept only at the slot
 * order the plane is dealt in, which is the order the owner sees it first.
 *
 * The slots are dealt row by row, left to right. For every slot the candidates are the pictures of the
 * pool; a picture is struck out when it stands in this row already, in the row above, or is the same
 * Aspirant as the slot's left neighbour (and, for the last of a row, its first), or as a card of the row
 * above that is at about the same place along the row. Of what is left, the picture shown least often
 * and longest ago wins, with a hash of the slot and the seed as the last tie. When nothing is left the
 * rules give way in this order: the Aspirant rule across rows, the gap, the Aspirant rule in the row.
 */
import { slotPlane, type WallGeom } from "./wall";

/** The shortest run of slots (in the order they are dealt) before the same picture comes back. */
export const MIN_GAP = 8;

/** A picture of the pool as the arrangement sees it: its Aspirant (a single one), else null. */
export type PoolKey = string | null;

/** A small, stable hash in [0, 1) of two integers: the tie break, so a layout is the same on every load. */
function hash01(a: number, b: number, seed: number): number {
  let h =
    (Math.imul(a + 1, 0x9e3779b1) ^
      Math.imul(b + 7, 0x85ebca6b) ^
      Math.imul(seed + 13, 0xc2b2ae35)) >>>
    0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * The picture (an index into the pool) of every slot of `g`. `keys[i]` is the Aspirant of picture `i`
 * when it shows one alone, else null. `along` is where each slot stands along its row, in pitches, at
 * slide 0 (it decides which cards of the row above count as "at about the same place").
 */
export function arrangePictures(
  g: WallGeom,
  keys: ReadonlyArray<PoolKey>,
  along: (slot: number) => number,
  seed = 1,
  groups?: ReadonlyArray<string | null>,
): Int32Array {
  const pool = keys.length;
  const out = new Int32Array(g.n);
  if (pool <= 1) return out;
  const used = new Int32Array(pool);
  const last = new Int32Array(pool).fill(-1e9);
  // The first slot of each row: the slots are dealt row by row, so a row is a run of slots.
  const rowStart = new Int32Array(g.rows + 1);
  for (let r = 0; r < g.rows; r++) rowStart[r + 1] = rowStart[r]! + g.rowCount[r]!;
  const inRow = new Uint8Array(pool);
  const inAbove = new Uint8Array(pool);
  const near: number[] = [];

  for (let r = 0; r < g.rows; r++) {
    const from = rowStart[r]!;
    const to = rowStart[r + 1]!;
    inRow.fill(0);
    inAbove.fill(0);
    if (r > 0) for (let s = rowStart[r - 1]!; s < from; s++) inAbove[out[s]!] = 1;
    for (let s = from; s < to; s++) {
      const leftPic = s > from ? out[s - 1]! : -1;
      const firstPic = s === to - 1 && to - from > 2 ? out[from]! : -1;
      const left = leftPic >= 0 ? keys[leftPic]! : null;
      const first = firstPic >= 0 ? keys[firstPic]! : null;
      const leftGroup = leftPic >= 0 ? (groups?.[leftPic] ?? null) : null;
      const firstGroup = firstPic >= 0 ? (groups?.[firstPic] ?? null) : null;
      // The characters of the row above that stand at about the same place along the row.
      near.length = 0;
      if (r > 0) {
        const x = along(s);
        for (let a = rowStart[r - 1]!; a < from; a++) {
          if (Math.abs(along(a) - x) < 1.6) near.push(a);
        }
      }
      let best = -1;
      let bestCost = Infinity;
      for (let level = 0; level < 4 && best < 0; level++) {
        for (let p = 0; p < pool; p++) {
          if (inRow[p] === 1) continue;
          // Level 0 keeps every rule; the later levels let go of the softer ones, in order.
          if (inAbove[p] === 1 && level < 3) continue;
          if (s - last[p]! < MIN_GAP && level < 2) continue;
          const key = keys[p]!;
          if (key !== null) {
            if (level < 3 && (key === left || key === first)) continue;
            if (level < 1 && near.some((a) => keys[out[a]!] === key)) continue;
          }
          // Look-alikes (the same scene or shot, whoever stands in it) keep apart the same way.
          const group = groups?.[p] ?? null;
          if (group !== null) {
            if (level < 3 && (group === leftGroup || group === firstGroup)) continue;
            if (level < 1 && near.some((a) => groups?.[out[a]!] === group)) continue;
          }
          const cost =
            used[p]! * 1000 +
            (s - last[p]! > 1e8 ? 0 : 500 - Math.min(500, s - last[p]!)) +
            hash01(s, p, seed);
          if (cost < bestCost) {
            bestCost = cost;
            best = p;
          }
        }
      }
      if (best < 0) best = s % pool;
      out[s] = best;
      inRow[best] = 1;
      used[best] = used[best]! + 1;
      last[best] = s;
    }
  }
  return out;
}

/** Where each slot stands along its row at slide 0, in pitches: what `arrangePictures` needs for `along`. */
export function alongAtRest(g: WallGeom): (slot: number) => number {
  const uv: [number, number] = [0, 0];
  return (slot) => {
    slotPlane(g, slot, 0, uv);
    return uv[0] / g.pitch;
  };
}
