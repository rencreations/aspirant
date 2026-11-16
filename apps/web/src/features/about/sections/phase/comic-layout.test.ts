import { describe, expect, it } from "vitest";

import {
  BOARD_W,
  comicBoard,
  GUTTER,
  pagesLabel,
  share,
  type Placed,
  type Sheet,
} from "./comic-layout";

/** The Aspirant: its cover and its five panels, as the collection gives their shapes. */
const ASPIRANT: Sheet[] = [
  { id: "cover", ratio: 1000 / 1333 },
  { id: "as-first", ratio: 1000 / 820 },
  { id: "as-layla-sword", ratio: 1000 / 1980 },
  { id: "as-fanny-face", ratio: 580 / 920 },
  { id: "as-duel", ratio: 1000 / 2000 },
  { id: "as-both", ratio: 1000 / 1950 },
];

/** Guinevere and Vexana. */
const PAIR: Sheet[] = [
  { id: "cover", ratio: 1200 / 1600 },
  { id: "gv-first", ratio: 2500 / 1250 },
  { id: "gv-vexana", ratio: 1650 / 2400 },
  { id: "gv-close", ratio: 2000 / 1700 },
  { id: "gv-gold", ratio: 1360 / 2120 },
  { id: "gv-meadow", ratio: 2500 / 2200 },
];

const overlap = (a: Placed, b: Placed) =>
  a.x < b.x + b.w - 0.01 &&
  b.x < a.x + a.w - 0.01 &&
  a.y < b.y + b.h - 0.01 &&
  b.y < a.y + a.h - 0.01;

describe.each([
  ["strips", ASPIRANT],
  ["page", PAIR],
] as const)("the %s board", (kind, sheets) => {
  const board = comicBoard(kind, sheets);

  it("places every picture once", () => {
    expect(board.pieces.map((p) => p.id).sort()).toEqual(sheets.map((s) => s.id).sort());
  });

  it("keeps the shape of every picture", () => {
    for (const piece of board.pieces) {
      const sheet = sheets.find((s) => s.id === piece.id);
      expect(piece.w / piece.h).toBeCloseTo(sheet?.ratio ?? 0, 5);
    }
  });

  it("keeps every picture on the board", () => {
    for (const piece of board.pieces) {
      expect(piece.x).toBeGreaterThanOrEqual(0);
      expect(piece.y).toBeGreaterThanOrEqual(0);
      expect(piece.x + piece.w).toBeLessThanOrEqual(BOARD_W + 0.01);
      expect(piece.y + piece.h).toBeLessThanOrEqual(board.height + 0.01);
    }
  });

  it("lets no two panels touch", () => {
    const panels = board.pieces.filter((p) => !(kind === "page" && p.id === "cover"));
    for (const a of panels) for (const b of panels) if (a !== b) expect(overlap(a, b)).toBe(false);
  });

  it("gives each piece a turn of its own in the arrival", () => {
    expect(board.pieces.map((p) => p.order).sort((a, b) => a - b)).toEqual(
      board.pieces.map((_, k) => k),
    );
  });

  it("puts the cover nearest", () => {
    const cover = board.pieces.find((p) => p.id === "cover");
    expect(cover?.depth).toBe(Math.max(...board.pieces.map((p) => p.depth)));
  });
});

describe("the strips", () => {
  const board = comicBoard("strips", ASPIRANT);

  it("stand in four columns of one width, a gutter apart", () => {
    const xs = [...new Set(board.pieces.map((p) => p.x))].sort((a, b) => a - b);
    expect(xs).toHaveLength(4);
    const w = board.pieces[0]?.w ?? 0;
    for (const piece of board.pieces) expect(piece.w).toBeCloseTo(w);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBeCloseTo(w + GUTTER);
  });

  it("start at different heights", () => {
    const tops = [0, 1, 2, 3].map((column) =>
      Math.min(
        ...board.pieces.filter((p) => Math.round(p.x / (p.w + GUTTER)) === column).map((p) => p.y),
      ),
    );
    expect(new Set(tops).size).toBe(4);
  });

  it("find room for a picture the plan does not name", () => {
    const more = comicBoard("strips", [...ASPIRANT, { id: "extra", ratio: 1 }]);
    expect(more.pieces).toHaveLength(7);
    expect(more.pieces.find((p) => p.id === "extra")).toBeDefined();
  });
});

describe("the page", () => {
  const board = comicBoard("page", PAIR);
  const at = (id: string): Placed => {
    const piece = board.pieces.find((p) => p.id === id);
    if (!piece) throw new Error(`The page has no piece called ${id}.`);
    return piece;
  };

  it("sets the three columns under the wide panel to one height and one width in all", () => {
    const wide = at("gv-first");
    const left = at("gv-vexana");
    const right = at("gv-gold");
    const upper = at("gv-close");
    const lower = at("gv-meadow");
    expect(left.h).toBeCloseTo(right.h);
    expect(upper.h + GUTTER + lower.h).toBeCloseTo(left.h);
    expect(right.x + right.w).toBeCloseTo(wide.x + wide.w);
    expect(upper.x - (left.x + left.w)).toBeCloseTo(GUTTER);
    expect(right.x - (upper.x + upper.w)).toBeCloseTo(GUTTER);
  });

  it("lays the cover, turned, over the near end of the wide panel only", () => {
    const cover = at("cover");
    expect(cover.turn).not.toBe(0);
    expect(overlap(cover, at("gv-first"))).toBe(true);
    for (const id of ["gv-close", "gv-gold", "gv-meadow"])
      expect(overlap(cover, at(id))).toBe(false);
  });

  it("falls back to the strips when it has too few panels", () => {
    expect(comicBoard("page", PAIR.slice(0, 4)).kind).toBe("strips");
  });
});

describe("the small words", () => {
  it("writes a share as a percentage", () => {
    expect(share(250, 1000)).toBe("25%");
    expect(share(1, 3)).toBe("33.333%");
  });

  it("counts pages in the singular and the plural", () => {
    expect(pagesLabel(42)).toBe("pages");
    expect(pagesLabel(1)).toBe("page");
  });
});
