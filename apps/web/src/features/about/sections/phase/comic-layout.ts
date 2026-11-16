/**
 * How the cover and the panels of a comic are set on its board. Plain numbers, so it can be
 * tested. The board is 1000 wide; its height comes out of the pictures' own shapes, so no panel
 * is ever cut or stretched.
 *
 * Two boards, one for each comic of the page:
 * - `strips`: four standing columns at different heights, like lengths of a webtoon hung side by
 *   side, with the cover at the head of one of them;
 * - `page`: one page of manga panels (a wide panel over a row of three columns of one height),
 *   with the cover laid on its upper corner like the book itself.
 */
export type BoardKind = "strips" | "page";

/** A picture to place: its name and its shape, width over height. */
export interface Sheet {
  readonly id: string;
  readonly ratio: number;
}

export interface Placed {
  readonly id: string;
  /** Its box on the board: the left and top corner, the width and the height. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Degrees it is turned by. */
  readonly turn: number;
  /** How near it is, 0 to 1: a near piece follows the pointer further. */
  readonly depth: number;
  /** Where it comes from as it arrives, in shares of its own size. */
  readonly from: { readonly x: number; readonly y: number };
  /** Its turn in the order of arrival, from 0. */
  readonly order: number;
}

export interface Board {
  readonly kind: BoardKind;
  readonly width: number;
  readonly height: number;
  readonly pieces: readonly Placed[];
}

export const BOARD_W = 1000;
/** The white between two panels. */
export const GUTTER = 26;

/** Which pictures stand in which column of the strips, by their place in the list (0 is the cover). */
const STRIP_COLUMNS: ReadonlyArray<readonly number[]> = [[2], [0, 1], [4, 3], [5]];
/** How far down each column starts. */
const STRIP_DROP: readonly number[] = [230, 60, 0, 250];

function strips(sheets: readonly Sheet[]): Board {
  const columns = STRIP_COLUMNS.length;
  const w = (BOARD_W - GUTTER * (columns - 1)) / columns;
  const pieces: Placed[] = [];
  // A picture the plan does not name goes to the column that is shortest so far.
  const ends = STRIP_DROP.map((drop) => drop);
  const put = (index: number, column: number) => {
    const sheet = sheets[index];
    if (!sheet) return;
    const h = w / sheet.ratio;
    const y = ends[column] ?? 0;
    pieces.push({
      id: sheet.id,
      x: column * (w + GUTTER),
      y,
      w,
      h,
      turn: 0,
      depth: index === 0 ? 1 : 0.35 + ((column * 37) % 50) / 100,
      // A column unrolls from above or from below, in turn.
      from: { x: 0, y: column % 2 === 0 ? 0.5 : -0.5 },
      order: pieces.length,
    });
    ends[column] = y + h + GUTTER;
  };
  const planned = new Set<number>();
  STRIP_COLUMNS.forEach((list, column) => {
    for (const index of list) {
      planned.add(index);
      put(index, column);
    }
  });
  sheets.forEach((_, index) => {
    if (planned.has(index)) return;
    put(index, ends.indexOf(Math.min(...ends)));
  });
  return { kind: "strips", width: BOARD_W, height: Math.max(...ends) - GUTTER, pieces };
}

/** The page starts here: the cover lies on the board's left edge and over the page's corner. */
const PAGE_X = 180;
const COVER_W = 300;

function page(sheets: readonly Sheet[]): Board {
  const [cover, wide, left, upper, right, lower] = sheets;
  if (!cover || !wide || !left || !upper || !right || !lower) return strips(sheets);
  const pageW = BOARD_W - PAGE_X;
  const wideH = pageW / wide.ratio;
  // The three columns under the wide panel share one height: the middle one is two panels.
  const stack = 1 / (1 / upper.ratio + 1 / lower.ratio);
  const rowH = (pageW - 2 * GUTTER + GUTTER * stack) / (left.ratio + right.ratio + stack);
  const leftW = left.ratio * rowH;
  const midW = (rowH - GUTTER) * stack;
  const rightW = right.ratio * rowH;
  const rowY = wideH + GUTTER;
  const midX = PAGE_X + leftW + GUTTER;
  const upperH = midW / upper.ratio;
  const coverH = COVER_W / cover.ratio;
  const pieces: Placed[] = [
    { id: wide.id, x: PAGE_X, y: 0, w: pageW, h: wideH, from: { x: 0, y: -0.45 }, depth: 0.3 },
    { id: left.id, x: PAGE_X, y: rowY, w: leftW, h: rowH, from: { x: -0.5, y: 0 }, depth: 0.5 },
    { id: upper.id, x: midX, y: rowY, w: midW, h: upperH, from: { x: 0, y: 0.6 }, depth: 0.65 },
    {
      id: right.id,
      x: midX + midW + GUTTER,
      y: rowY,
      w: rightW,
      h: rowH,
      // It stands on the board's outer edge: it comes up more than it comes in, so it never
      // starts beyond the edge of the page.
      from: { x: 0.12, y: 0.4 },
      depth: 0.45,
    },
    {
      id: lower.id,
      x: midX,
      y: rowY + upperH + GUTTER,
      w: midW,
      h: midW / lower.ratio,
      from: { x: 0, y: 0.6 },
      depth: 0.8,
    },
    {
      id: cover.id,
      x: 0,
      // Over the near end of the wide panel, which shows the same scene as the cover does.
      y: Math.max(0, (wideH - coverH) / 2 + 24),
      w: COVER_W,
      h: coverH,
      from: { x: -0.3, y: -0.3 },
      depth: 1,
    },
  ].map((piece, order) => ({ ...piece, turn: piece.id === cover.id ? -5 : 0, order }));
  return { kind: "page", width: BOARD_W, height: rowY + rowH, pieces };
}

/** Set the cover (first) and the panels of a comic on a board of the given kind. */
export function comicBoard(kind: BoardKind, sheets: readonly Sheet[]): Board {
  return kind === "page" ? page(sheets) : strips(sheets);
}

/** A share of a length as a percentage for the stylesheet: 250 of 1000 is `25%`. */
export function share(part: number, whole: number): string {
  return `${Number(((part / whole) * 100).toFixed(3))}%`;
}

/** The comic's page count as the page says it: `42 pages`, `1 page`. */
export function pagesLabel(pages: number): string {
  return pages === 1 ? "page" : "pages";
}
