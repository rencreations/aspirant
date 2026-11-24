import { describe, expect, it } from "vitest";

import {
  BOOK_H,
  BOOK_SCALE,
  BOOK_W,
  READ_AT,
  READ_TILT,
  bookToBody,
  boardEnd,
  gripLocal,
  readReach,
} from "./book-hold";

describe("where her palms take the book", () => {
  it("puts each palm under the lower edge of its board, never inside the book", () => {
    for (const side of [-1, 1] as const) {
      for (const o of [0, 0.3, 0.6, 1]) {
        const g = gripLocal(side, o);
        expect(g.y).toBeLessThan((-BOOK_H * BOOK_SCALE) / 2);
        // Behind the cover (toward her), so the boards are between the palm and the visitor.
        const end = boardEnd(side, o);
        expect(g.z).toBeLessThan(end.z * 0.78 - 0.01);
      }
    }
  });

  it("spreads the hands as the book opens, the left one on her left", () => {
    const shut = readReach(1, 0);
    const open = readReach(1, 1);
    expect(open.x).toBeGreaterThan(shut.x);
    expect(open.x).toBeGreaterThan(0.05);
    expect(readReach(-1, 1).x).toBeCloseTo(-open.x, 9);
    expect(readReach(-1, 1).y).toBeCloseTo(open.y, 9);
  });

  it("tilts the book back: its top is further from her than its bottom, the pages look up at her", () => {
    expect(READ_TILT).toBeGreaterThan(0.5);
    const top = bookToBody({ x: 0, y: (BOOK_H * BOOK_SCALE) / 2, z: 0 }, READ_TILT, READ_AT);
    const bottom = bookToBody({ x: 0, y: (-BOOK_H * BOOK_SCALE) / 2, z: 0 }, READ_TILT, READ_AT);
    expect(top.z).toBeGreaterThan(bottom.z);
    expect(top.y).toBeGreaterThan(bottom.y);
    // The inside of the page (toward -z in the book's frame) turns up toward her face.
    const inside = bookToBody({ x: 0, y: 0, z: -1 }, READ_TILT, { x: 0, y: 0, z: 0 });
    expect(inside.y).toBeGreaterThan(0.5);
    expect(inside.z).toBeLessThan(0);
  });

  it("keeps the whole open book clear of her chest and in front of her", () => {
    for (const side of [-1, 1] as const) {
      const end = boardEnd(side, 1);
      for (const y of [-1, 0, 1]) {
        const p = bookToBody(
          { x: end.x, y: (y * BOOK_H * BOOK_SCALE) / 2, z: end.z },
          READ_TILT,
          READ_AT,
        );
        // Her chest is a hand span behind this plane.
        expect(p.z).toBeGreaterThan(0.1);
      }
    }
    expect(BOOK_W * BOOK_SCALE * 2).toBeGreaterThan(0.15);
  });
});
