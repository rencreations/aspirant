/**
 * The beats of the list as pure functions of two numbers (round six). `u` is the list's beat (0 to
 * `LIST_LAST`; negative in the lead, in real screens) and the scroll's own lead is `LIST_LEAD`. The
 * numbers follow the oryzo.ai study (`docs/design/home-reference/ref-oryzo.md`): reveals are products
 * of `seg`, the strip's index is eased in its zones, nothing here knows about the DOM.
 */
import { seg } from "../vp";

import { FRAME_COUNT, LIST_LAST, LIST_LEAD } from "./stations";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const sineInOut = (u: number): number => 0.5 * (1 - Math.cos(Math.PI * clamp01(u)));
export const cubicOut = (u: number): number => 1 - (1 - clamp01(u)) ** 3;
export const cubicInOut = (u: number): number => {
  const t = clamp01(u);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};
/** Oryzo's `backOut` (s = 1.70158): the dot of the frame pops with it. */
export const backOut = (u: number): number => {
  const t = clamp01(u) - 1;
  return 1 + 2.70158 * t ** 3 + 1.70158 * t ** 2;
};

export interface ListBeats {
  /** The rise, linear in the scroll: 0 at the start of the lead, 1 at the section's start. */
  rise: number;
  /** The strip coming up (eased), the heading (later), the cue and the frame's chrome. */
  strip: number;
  head: number;
  cue: number;
  chrome: number;
  /** The strip's position, 0 to `FRAME_COUNT - 1`. */
  index: number;
  /** The last frame growing into the whole screen: linear, and eased. */
  expandRaw: number;
  expand: number;
}

/** What the list does at beat `u`. Writes into `out` (no allocation). */
export function listBeats(u: number, out: ListBeats): ListBeats {
  out.rise = clamp01((u + LIST_LEAD) / LIST_LEAD);
  out.strip = sineInOut(seg(out.rise, 0, 0.9));
  out.head = cubicOut(seg(out.rise, 0.3, 1));
  out.cue = seg(out.rise, 0.88, 1);
  out.chrome = seg(out.rise, 0.5, 1);
  out.index = Math.min(FRAME_COUNT - 1, Math.max(0, u));
  out.expandRaw = seg(u, FRAME_COUNT - 1, LIST_LAST);
  out.expand = cubicInOut(out.expandRaw);
  return out;
}

export function newListBeats(): ListBeats {
  return { rise: 0, strip: 0, head: 0, cue: 0, chrome: 0, index: 0, expandRaw: 0, expand: 0 };
}

/**
 * How far below its place a thumbnail still is, 0 (in place) to 1 (a screen below), for the
 * `order`th thumbnail from the frame outward (0 is the one next to the frame): the near ones come up
 * first, the far ones a little later, as Oryzo's row flies in with a stagger.
 */
export function thumbRise(rise: number, order: number): number {
  const a = Math.min(0.3, 0.05 * order);
  return 1 - sineInOut(seg(rise, a, a + 0.7));
}
