import type { BackdropKind, BackdropOptions } from "../../fx/backdrop";

import { T } from "./timeline";

/** What the section asks of the live backdrop at a moment of its story. */
export interface BackdropAsk {
  readonly kind: BackdropKind;
  readonly options: BackdropOptions;
}

/** The chase: streaks run past, level with the road. */
const CHASE: BackdropAsk = {
  kind: "speed-lines",
  options: { amount: 0.85, angle: 90, speed: 1.5 },
};
/** She has stopped, panting and waving: a soft warm sky. */
const BREATH: BackdropAsk = {
  kind: "soft-aurora",
  options: { amount: 0.85, speed: 0.8 },
};
/** She reads the comic: halftone dots under the big word. */
const COMIC: BackdropAsk = {
  kind: "pixel-blast",
  options: { amount: 0.5, speed: 0.7 },
};

/** The backdrop at the section's virtual clock: one kind for each part of the story (a 0.5 s cross-fade joins them). */
export function backdropAt(local: number): BackdropAsk {
  if (local < T.tetraTo - 0.02) return CHASE;
  if (local < T.zoomFrom) return BREATH;
  return COMIC;
}
