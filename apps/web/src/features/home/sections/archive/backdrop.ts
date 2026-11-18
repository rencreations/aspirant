import type { BackdropKind, BackdropOptions } from "../../fx/backdrop";

/** What the section asks of the live backdrop. */
export interface BackdropAsk {
  readonly kind: BackdropKind;
  readonly options: BackdropOptions;
}

/** The ten covers stand on a drifting grid, cells near the pointer fill in colour. */
export const GRID: BackdropAsk = {
  kind: "squares",
  options: { amount: 0.8, speed: 0.8 },
};

/**
 * The covers have gone and the footer's card rises: thin-film colour. The footer asks for the same
 * (`footer/backdrop.ts` holds the same numbers), so the hand-over has no cross-fade.
 */
export const CALM: BackdropAsk = {
  kind: "iridescence",
  options: { amount: 0.7, speed: 0.6 },
};

/**
 * The backdrop at the route's clock `S` (screens). The grid comes in with the entry (before it the
 * bend section's last backdrop stands) and gives way to the calm one as the covers lift away.
 * Returns null while the entry has not begun (the neighbour's backdrop stays).
 */
export function backdropAt(S: number, entryFrom: number, coversOut: number): BackdropAsk | null {
  if (S <= entryFrom) return null;
  return S < coversOut ? GRID : CALM;
}
