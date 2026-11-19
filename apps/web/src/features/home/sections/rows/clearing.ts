/**
 * The rows' pose while the transition plays: the field's own pose of a card (`wallSlotPose`) plus two
 * displacements along the plane's rows, both zero until their beat.
 *
 *   the space  the cards of the middle row on either side of the film slide apart (a card on the left
 *              goes left, a card on the right goes right, all by the same push) so one more place of
 *              the row, the size of a picture, stands between them. It is a function of each card's
 *              place on the row, so it holds as the rows go on sliding: the film is attached to the row.
 *   the clearing  every card slides off along its own row, away from the film's column, and fades, the
 *              card nearest the film first, until the film stands alone. A card never leaves its row.
 *
 * Pure and allocation free: it writes the card pose it is given. With both at 0 it is `wallSlotPose`.
 */
import { planeToScreen } from "../../fx/image-field/grid";
import { smootherstep } from "../../fx/image-field/math";
import {
  rowWay,
  slotPlane,
  wallSlotPose,
  wrapAround,
  type WallGeom,
} from "../../fx/image-field/wall";
import type { CardPose } from "../../fx/image-field/types";

import { ANGLE_SIZE, clearRadius, leaveOf } from "./journey";

/** Rows count more than a step along a row: the cards of the other rows are further from the film than their plane distance says. */
const ACROSS = 1.25;
/**
 * The clearing is measured on the screen, not on the plane: the plane is tilted, so a front that grows
 * evenly on it sweeps most of the visible cards in its first half and spends the rest on the far top
 * rows. On the screen the front grows evenly over what the visitor sees. A step down the screen counts
 * this much more than a step across it (the screen is wider than it is tall, and the rows run across).
 */
const SCREEN_ACROSS = 1.4;
/** The width of the front in which a card goes, as a share of the reach. */
const FEATHER_SHARE = 0.5;
/** A card slides this many card widths along its row before it is gone. */
const PUSH_WIDTHS = 1.8;

/** What the transition has done so far, in the plane's terms. */
export interface RowsPlay {
  /** Where the film is along the middle row (plane u). */
  filmU: number;
  /** 0 to 1: the space in the middle row is open. */
  gap: number;
  /** 0 to 1: the clearing has grown. */
  clear: number;
  /** How far the clearing must reach to take in every card (`clearingReach`, made once a frame). */
  reach: number;
}

/**
 * How far a card beside the film is pushed when the space is open, in the plane's pixels. A neighbour
 * centre must stand (film half width + the row's own gap + card half width) from the film's centre; with
 * the film between two cards it stood half a pitch away. With the film as wide as a card that is
 * exactly half a pitch: the space is one more place of the row.
 */
export function gapPush(g: WallGeom): number {
  const rowGap = g.pitch - g.cardW;
  return ((ANGLE_SIZE + 1) / 2) * g.cardW + rowGap - g.pitch / 2;
}

const place: [number, number] = [0, 0];
const at: [number, number] = [0, 0];
const film: [number, number] = [0, 0];

/** The u of a card at `u0` on row `r` once the space is open: the neighbours of the film slide apart. */
function spaced(g: WallGeom, r: number, u0: number, play: RowsPlay): number {
  if (r !== g.midRow || play.gap <= 0) return u0;
  const len = g.rowCount[r]! * g.pitch;
  const d = wrapAround(u0 - play.filmU, len);
  return u0 + Math.sign(d) * gapPush(g) * play.gap;
}

/** The u of a slot in the plane after the slide and the space (the clearing is not in it). */
export function spacedU(g: WallGeom, slot: number, slide: number, play: RowsPlay): number {
  slotPlane(g, slot, slide, place);
  return spaced(g, g.slotRow[slot]!, place[0], play);
}

/** The reach the clearing needs to cover every card of the plane from a film at `filmU`. */
export function clearingReach(g: WallGeom, filmU: number): number {
  let half = 0;
  let across = 0;
  for (let r = 0; r < g.rows; r++) {
    half = Math.max(half, (g.rowCount[r]! * g.pitch) / 2 + Math.abs(g.rowCenter[r]!));
    across = Math.max(across, Math.abs(g.rowV[r]!));
  }
  return Math.hypot(half + Math.abs(filmU) + gapPush(g), ACROSS * across);
}

/** How far past the screen's edge a card still counts as seen (CSS px): a card pushed by the pointer, the feather. */
const SEEN_MARGIN = 60;

/**
 * The reach the clearing needs to take in every card that can be seen: the farthest of the screen's
 * four corners (grown by a margin) from the film's place on the screen, in the clearing's own metric
 * (frame px, a step down counting `SCREEN_ACROSS` times a step across).
 */
export function visibleReach(g: WallGeom, vw: number, vh: number, filmU: number): number {
  planeToScreen(g, filmU, 0, film);
  const hw = vw / 2 + SEEN_MARGIN;
  const hh = vh / 2 + SEEN_MARGIN;
  let reach = 0;
  for (const X of [-hw, hw]) {
    for (const Y of [-hh, hh]) {
      reach = Math.max(reach, Math.hypot(X - film[0], SCREEN_ACROSS * (Y - film[1])));
    }
  }
  return reach;
}

/** The pose of the card in `slot` with the rows at `slide` (the plane's pixels) and the transition at `play`. */
export function rowsPose(
  g: WallGeom,
  slot: number,
  slide: number,
  play: RowsPlay,
  out: CardPose,
): CardPose {
  wallSlotPose(g, slot, slide, out);
  const r = g.slotRow[slot]!;
  slotPlane(g, slot, slide, place);
  const u0 = place[0];
  const v = place[1];
  const u = spaced(g, r, u0, play);
  // The space moves the card along the row only.
  if (u !== u0) addAlong(g, u - u0, out);
  if (play.clear <= 0) return out;
  const du = u - play.filmU;
  // The card's distance from the film on the screen (frame px).
  planeToScreen(g, u, v, at);
  planeToScreen(g, play.filmU, 0, film);
  const rho = Math.hypot(at[0] - film[0], SCREEN_ACROSS * (at[1] - film[1]));
  const feather = FEATHER_SHARE * play.reach;
  const radius = clearRadius(play.clear, play.reach, feather);
  const gone = leaveOf(radius, rho, feather);
  if (gone <= 0) return out;
  const k = smootherstep(gone);
  // Away from the film's column, along the card's own row (a card exactly in the column goes the row's way).
  const way = Math.abs(du) > 1e-6 ? Math.sign(du) : rowWay(r);
  addAlong(g, way * k * PUSH_WIDTHS * g.cardW, out);
  out.opacity = 1 - smootherstep(Math.min(1, Math.max(0, (gone - 0.2) / 0.8)));
  return out;
}

/** Move a pose by `du` along the plane's rows. */
function addAlong(g: WallGeom, du: number, out: CardPose): void {
  out.x += du * g.right[0];
  out.y += du * g.right[1];
  out.z += du * g.right[2];
}
