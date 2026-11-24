import { clamp01, ramp } from "../ease";

import { OPEN_V } from "./book";

/**
 * Where the comic book is and where her hands take it, as arithmetic (no three), so the pose that
 * reaches and the mesh that follows agree by construction. The book's own frame: x across with the
 * spine at 0, y up the page, z out of the outer cover toward the visitor. The inside of the book
 * (the pages) looks toward -z, toward her. Her body frame: metres, the feet's middle the origin,
 * y up, z toward the visitor (what `channels.ts` calls her own frame).
 */

/** The size of one board, in metres: its width from the spine, its height. */
export const BOOK_W = 0.088;
export const BOOK_H = 0.122;
/** A board's thickness, a block of pages, and the radius of the cloth over the spine. */
export const BOARD_T = 0.0036;
export const PAGE_T = 0.0068;
/** The book is drawn this much bigger than its measures above (the whole book, every shape of it). */
export const BOOK_SCALE = 1.12;

/** The open book as she reads it: where its middle is in her body frame, and how far it is tilted. */
export const READ_AT = { x: 0, y: 0.282, z: 0.2 } as const;
/**
 * The tilt about the book's x axis (radians, positive leans the top away from her, toward the
 * visitor, so the pages look up and back at her face). The book is turned toward her eyes.
 */
export const READ_TILT = 0.8;

/** The tilt when she carries it shut in one hand: nearly upright, the cover toward the visitor. */
export const CARRY_TILT = 0.28;
/**
 * Where one palm is under a shut book, in the book's frame: under the lower edge, a little to the
 * outer side of its middle, behind it. The forearm comes in below the book, never through it.
 */
export const ONE_HAND_X = -0.03;
export const ONE_HAND_Y = (-BOOK_H * BOOK_SCALE) / 2 - 0.024;
export const ONE_HAND_Z = -0.014;

/** How far under the lower edge of a board her palm sits, and how far behind it (toward her). */
const GRIP_BELOW = 0.026;
const GRIP_BEHIND = 0.018;
/** Her palms hold the boards this far in from the outer edge, as a share of the width. */
const GRIP_IN = 0.78;

/**
 * Where the board of one `side` (-1 the back cover on the left of the visitor's view, 1 the front
 * cover on the right) has its outer edge, for an openness `o` (0 shut, 1 open), in the book's frame.
 * Writes x and z of the board's far end.
 */
export function boardEnd(
  side: -1 | 1,
  o: number,
  out: { x: number; z: number } = { x: 0, z: 0 },
): { x: number; z: number } {
  const open = clamp01(o);
  // Shut, both boards lie one over the other; open, each leans back by OPEN_V from the spine.
  const spread = ramp(0.15, 1, open);
  const lean = OPEN_V * spread;
  out.x = side * BOOK_W * BOOK_SCALE * Math.cos(lean) * (0.35 + 0.65 * spread);
  out.z = -BOOK_W * BOOK_SCALE * Math.sin(lean) * spread;
  return out;
}

/** Where her palm is for a board, in the book's frame: under its lower edge, a little behind it. */
export function gripLocal(
  side: -1 | 1,
  o: number,
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): { x: number; y: number; z: number } {
  const end = boardEnd(side, o);
  out.x = end.x * GRIP_IN;
  out.y = (-BOOK_H * BOOK_SCALE) / 2 - GRIP_BELOW;
  out.z = end.z * GRIP_IN - GRIP_BEHIND;
  return out;
}

/**
 * A point of the book's frame in her body frame, for a book whose middle is at `READ_AT`, tilted by
 * `tilt` about x. (A rotation about x: y goes up the page, z out of the cover.)
 */
export function bookToBody(
  p: { x: number; y: number; z: number },
  tilt: number,
  at: { x: number; y: number; z: number },
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): { x: number; y: number; z: number } {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  out.x = at.x + p.x;
  out.y = at.y + p.y * c - p.z * s;
  out.z = at.z + p.y * s + p.z * c;
  return out;
}

/** The point a palm reaches in her body frame while she reads (the pose `read` asks for it). */
export function readReach(
  side: -1 | 1,
  o: number,
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): { x: number; y: number; z: number } {
  return bookToBody(gripLocal(side, o), READ_TILT, READ_AT, out);
}
