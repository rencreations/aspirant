import { create } from "zustand";

/**
 * A page that wants the top bar to keep one look instead of following whatever is behind it (the
 * story's chapters): `theme` fixes the bar's theme (the visitor's reading theme), and `bare` says
 * the bar is over the page's opening picture, where it has no background at all. A page sets it
 * when it opens and clears it when it goes. The bar reads it in `components/nav/site-nav.tsx`.
 *
 * `fade` lets the bar's plate come and go smoothly instead of at once (the Design room: the bar is
 * bare over its film and takes its plate as the search and the filters dock under it).
 */
export interface NavLock {
  readonly theme: "storm" | "daybreak" | null;
  readonly bare: boolean;
  readonly fade: boolean;
  /**
   * The bar has folded away (the comic reader, once the visitor has scrolled off the very top): it
   * shrinks toward the top left and fades, and is out of reach until it comes back.
   */
  readonly away: boolean;
}

export const useNavLock = create<NavLock>()(() => ({
  theme: null,
  bare: false,
  fade: false,
  away: false,
}));
