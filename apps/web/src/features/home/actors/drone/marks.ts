/**
 * The icons of the drone's speech bubble and its shock mark: the six of `scripts/home/drone/marks.cjs`
 * (`public/img/home/marks.webp`, 576 by 384, a grid of 192 pixel cells) and three that are drawn in
 * code beside them (a music note, three dots, a drop of sweat) in a third row, so the scene has
 * one picture of nine cells. No three here.
 */

export const ICON_NAMES = [
  "heart",
  "sparkle",
  "thanks",
  "smile",
  "bang",
  "question",
  "note",
  "dots",
  "sweat",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** The picture of the file: 3 columns by 2 rows of `CELL` pixels. The scene makes it 3 by 3. */
export const CELL = 192;
export const COLUMNS = 3;
export const ROWS = 3;

interface Icon {
  col: number;
  row: number;
}

export const ICONS: Readonly<Record<IconName, Icon>> = {
  heart: { col: 0, row: 0 },
  sparkle: { col: 1, row: 0 },
  thanks: { col: 2, row: 0 },
  smile: { col: 0, row: 1 },
  bang: { col: 1, row: 1 },
  question: { col: 2, row: 1 },
  note: { col: 0, row: 2 },
  dots: { col: 1, row: 2 },
  sweat: { col: 2, row: 2 },
};

/** The cell's rectangle in uv, from the top left (a texture that is not flipped). */
export function iconUv(name: IconName, out: { u: number; v: number; du: number; dv: number }) {
  const icon = ICONS[name];
  out.u = icon.col / COLUMNS;
  out.v = icon.row / ROWS;
  out.du = 1 / COLUMNS;
  out.dv = 1 / ROWS;
  return out;
}
