/**
 * The cue at a rest: a thin line in the lower right corner that appears when the visitor has stood
 * still in a composed frame for a while and says "scroll on". The page is made of scenes that
 * fire at a threshold, so after a scene the next step is not obvious. Pure arithmetic: the
 * component reads the page and asks.
 */

/** How long the visitor must have stood still (no wheel, touch or key) before the cue shows, in ms. */
export const CUE_AFTER_MS = 1800;

export interface CueInput {
  /** The opening has ended and the page is shown. */
  readonly open: boolean;
  /** A hold is on: a scene plays, or a preview or a viewer holds the page. */
  readonly held: boolean;
  /** Milliseconds since the last input. */
  readonly idleMs: number;
  /** The scroll position, the screen's height and the document's height, in pixels. */
  readonly scrollY: number;
  readonly viewH: number;
  readonly docH: number;
}

/**
 * True when the cue shows. Not at the top (the hero has its own cue), not near the foot (the footer
 * says "keep scrolling or press N" itself), not while anything holds the page, and not until the
 * visitor has stood still for `CUE_AFTER_MS`.
 */
export function cueShown(input: CueInput): boolean {
  if (!input.open || input.held) return false;
  if (input.viewH <= 0) return false;
  if (input.scrollY < 0.35 * input.viewH) return false;
  if (input.docH - (input.scrollY + input.viewH) < 1.2 * input.viewH) return false;
  return input.idleMs >= CUE_AFTER_MS;
}
