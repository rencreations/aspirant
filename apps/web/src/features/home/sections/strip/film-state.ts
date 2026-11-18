/**
 * The film plane's whole state as a pure function of the story position `S` (`../story.ts`, in story
 * screens). The rows and the strip both drive the one `film` actor and their stories meet (the strip's
 * start is the rows' end), so both call this: the later section can never disagree with the earlier one. The
 * rows' part is the angled film riding a gap of the middle row and turning upright; the strip's part
 * is the expand, the pull, the orbit and the fly-off. See `rows/journey.ts` and `strip/journey.ts`.
 */
import { buildFormations } from "../../fx/image-field/formations";
import { rowsGeom } from "../../fx/video-plane/hero";
import { DEFAULT_STATE, type FilmState } from "../../fx/video-plane/types";
import { appearAt, filmAlong, morphAt } from "../rows/journey";
import { STORY } from "../story";

import { makeBeats, stripBeats } from "./journey";

/** The cards of the picture field (the rows are laid out for this many). */
const FIELD_CARDS = 18;

const beats = makeBeats();

/** The film's rows geometry and the rows' scale against the wall's, made once for a screen size. */
export interface RowsScale {
  /** A card and its gap along a row, in the rows plane's pixels. */
  pitch: number;
  /** Pixels of the rows plane for one pixel of the field's slide (the ratio of the two card widths). */
  perWall: number;
}

let scaleFor: { w: number; h: number; scale: RowsScale } | null = null;

export function rowsScale(vp: { readonly w: number; readonly h: number }): RowsScale {
  if (scaleFor?.w === vp.w && scaleFor.h === vp.h) return scaleFor.scale;
  const scale: RowsScale = {
    pitch: rowsGeom(vp).pitch,
    perWall: buildFormations(FIELD_CARDS, vp).rowsPerWall,
  };
  scaleFor = { w: vp.w, h: vp.h, scale };
  return scale;
}

/**
 * The state of the film at `S`. `travel` is how far the rows slide in all, in the rows plane's pixels
 * (it depends on where the rows stood when the section began, so only the rows know it; the strip
 * passes 0, because by then the rows have come to rest and the film stands at the middle).
 * Writes `out` and returns it.
 */
export function filmStateAt(S: number, travel: number, out: FilmState): FilmState {
  const s = S - STORY.rows.start;
  const b = stripBeats(S - STORY.strip.start, beats);
  Object.assign(out, DEFAULT_STATE);
  out.heroBox = null;
  out.appear = appearAt(s);
  out.morph = morphAt(s);
  // The film rides the middle row: its gap runs from the right to the middle as the rows slide.
  out.angleU = travel * filmAlong(s);
  out.angleV = 0;
  out.expand = b.expand;
  out.pull = b.pull;
  out.fly = b.fly;
  out.travel = b.travel;
  out.effect = 1 - b.clean;
  return out;
}
