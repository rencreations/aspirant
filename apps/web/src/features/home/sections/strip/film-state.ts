/**
 * The film plane's whole state as a pure function of the story position `S` (`../story.ts`, in story
 * screens). The rows and the strip both drive the one `film` actor and their stories meet (the strip's
 * start is the rows' end), so both call this: the later section can never disagree with the earlier one. The
 * rows' part is the angled film riding a gap of the middle row and turning upright; the strip's part
 * is the expand, the pull, the orbit and the fly-off. See `rows/journey.ts` and `strip/journey.ts`.
 */
import { TRAILER_FILM } from "../../fx/video-plane/data";
import { DEFAULT_STATE, type FilmState } from "../../fx/video-plane/types";
import { ANGLE_SIZE, appearAt, filmAlong, morphAt } from "../rows/journey";
import { STORY } from "../story";

import { makeBeats, stripBeats } from "./journey";

const beats = makeBeats();

/**
 * The state of the film at `S`. `travel` is where the film starts along the middle row, in the rows
 * plane's pixels, signed (it depends on where the rows stood and how fast they went when the play
 * began, so only the rows know it; the strip passes 0, because by then the rows have come to rest and
 * the film stands at the middle). `a` is the slope the rows' slide starts with (`slideShape`).
 * Writes `out` and returns it.
 */
export function filmStateAt(S: number, travel: number, out: FilmState, a = 0): FilmState {
  const s = S - STORY.rows.start;
  const b = stripBeats(S - STORY.strip.start, beats);
  Object.assign(out, DEFAULT_STATE);
  out.heroBox = null;
  out.appear = appearAt(s);
  out.morph = morphAt(s);
  // The film rides the middle row: its gap runs from the right to the middle as the rows slide.
  out.angleU = travel * filmAlong(s, a);
  out.angleV = 0;
  out.angleSize = ANGLE_SIZE;
  out.aspect = TRAILER_FILM.aspect;
  out.expand = b.expand;
  out.pull = b.pull;
  out.fly = b.fly;
  out.travel = b.travel;
  return out;
}
