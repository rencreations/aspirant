/**
 * The rows' pose while the transition plays: the field's own pose of a card (`wallSlotPose`) plus two
 * displacements along the plane, both zero until their beat.
 *
 *   the space  the cards of the middle row on either side of the film slide apart (a card on the left
 *              goes left, a card on the right goes right, all by the same push) so a clear space the
 *              film's size stands between them. It is a function of each card's place on the row, so it
 *              holds as the rows go on sliding: the film is attached to the row.
 *   the clearing  every card is pushed away from the film along the plane and fades, the card nearest
 *              the film first, until the film stands alone.
 *
 * Pure and allocation free: it writes the card pose it is given. With both at 0 it is `wallSlotPose`.
 */
import { smootherstep } from "../../fx/image-field/math";
import {
  rowWay,
  slotPlane,
  wallSlotPose,
  wrapAround,
  type WallGeom,
} from "../../fx/image-field/wall";
import type { CardPose } from "../../fx/image-field/types";

import { ANGLE_SIZE, GAP_MARGIN, clearRadius, leaveOf } from "./journey";

/** Rows count more than a step along a row: the cards of the other rows are further from the film than their plane distance says. */
const ACROSS = 1.25;
/** A card goes over this many pitches (a share of a card and its gap). */
const FEATHER_PITCHES = 1.1;
/** A card is pushed this many card widths before it is gone. */
const PUSH_WIDTHS = 1.5;

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

/** How far a card beside the film is pushed when the space is open, in the plane's pixels. */
export function gapPush(g: WallGeom): number {
  // A neighbour centre must stand (film half width + margin + card half width) from the film's centre;
  // with the film between two cards it stood half a pitch away.
  return ((ANGLE_SIZE + 1) / 2 + GAP_MARGIN) * g.cardW - g.pitch / 2;
}

const place: [number, number] = [0, 0];

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
  if (u !== u0) addAlong(g, u - u0, 0, out);
  if (play.clear <= 0) return out;
  const du = u - play.filmU;
  const dv = v * ACROSS;
  const rho = Math.hypot(du, dv);
  const feather = FEATHER_PITCHES * g.pitch;
  const radius = clearRadius(play.clear, play.reach, feather);
  const gone = leaveOf(radius, rho, feather);
  if (gone <= 0) return out;
  const k = smootherstep(gone);
  // Away from the film, along the plane (a card exactly over the film goes along the row).
  const along = rho > 1e-6 ? du / rho : rowWay(r);
  const across = rho > 1e-6 ? dv / rho / ACROSS : 0;
  const push = k * PUSH_WIDTHS * g.cardW;
  addAlong(g, along * push, across * push, out);
  out.opacity = 1 - smootherstep(Math.min(1, Math.max(0, (gone - 0.2) / 0.8)));
  return out;
}

/** Move a pose by `du` along the plane's rows and `dv` across them. */
function addAlong(g: WallGeom, du: number, dv: number, out: CardPose): void {
  out.x += du * g.right[0] + dv * g.up[0];
  out.y += du * g.right[1] + dv * g.up[1];
  out.z += du * g.right[2] + dv * g.up[2];
}
