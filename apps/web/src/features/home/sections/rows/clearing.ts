/**
 * The clearing: the cards of the rows leave from the film outward. Each card is pushed away from the
 * film along the rows' plane and fades, the card nearest the film first, until the film stands alone.
 * It is the field's own rows pose (`wallSlotPose`) plus a displacement that is zero until the
 * clearing starts, so the field shows the same picture with and without it (`clearing.test.ts`).
 * Pure, and allocation free: it writes the card pose it is given.
 */
import { smootherstep } from "../../fx/image-field/math";
import { rowWay, wallSlotPose, wrapAround, type WallGeom } from "../../fx/image-field/wall";
import type { CardPose } from "../../fx/image-field/types";

import { clearRadius, leaveOf } from "./journey";

/** Rows count more than a step along a row: the cards of the other rows are further from the film than their plane distance says. */
const ACROSS = 1.25;
/** A card goes over this many pitches (a share of a card and its gap). */
const FEATHER_PITCHES = 1.1;
/** A card is pushed this many card widths before it is gone. */
const PUSH_WIDTHS = 1.5;

/** Where a slot is on the rows' plane (u along the rows, v across them) after the slide, the field's own. */
export function slotPlace(
  g: WallGeom,
  slot: number,
  slide: number,
  out: [number, number],
): [number, number] {
  const r = g.slotRow[slot]!;
  const c = g.slotCol[slot]!;
  const count = g.rowCount[r]!;
  out[0] = wrapAround((c - (count - 1) / 2) * g.pitch + rowWay(r) * slide, count * g.pitch);
  out[1] = ((g.rows - 1) / 2 - r) * g.rise;
  return out;
}

const place: [number, number] = [0, 0];

/** The reach the clearing needs to cover every card of the rows from a film at `centreU` of the middle row. */
export function clearingReach(g: WallGeom, centreU: number): number {
  const half = (g.rowCount[0]! * g.pitch) / 2;
  return Math.hypot(half + Math.abs(centreU), ACROSS * ((g.rows - 1) / 2) * g.rise);
}

/**
 * The pose of the card in `slot` with the rows at `slide` (the rows' plane pixels) and the clearing at
 * `progress` (0 nothing has left, 1 everything has) around a film at `centreU` of the middle row.
 */
export function clearedPose(
  g: WallGeom,
  slot: number,
  slide: number,
  centreU: number,
  progress: number,
  out: CardPose,
): CardPose {
  wallSlotPose(g, slot, slide, out);
  if (progress <= 0) return out;
  slotPlace(g, slot, slide, place);
  const du = place[0] - centreU;
  const dv = place[1] * ACROSS;
  const rho = Math.hypot(du, dv);
  const feather = FEATHER_PITCHES * g.pitch;
  const radius = clearRadius(progress, clearingReach(g, centreU), feather);
  const gone = leaveOf(radius, rho, feather);
  if (gone <= 0) return out;
  const k = smootherstep(gone);
  // Away from the film, along the plane (a card exactly over the film goes along the row).
  const along = rho > 1e-6 ? du / rho : 1;
  const across = rho > 1e-6 ? dv / rho / ACROSS : 0;
  const push = k * PUSH_WIDTHS * g.cardW;
  const pu = along * push;
  const pv = across * push;
  out.x += pu * g.right[0] + pv * g.up[0];
  out.y += pu * g.right[1] + pv * g.up[1];
  out.z += pu * g.right[2] + pv * g.up[2];
  out.opacity = 1 - smootherstep(Math.min(1, Math.max(0, (gone - 0.2) / 0.8)));
  return out;
}
