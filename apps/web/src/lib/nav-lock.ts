import { create } from "zustand";

/**
 * A page that wants the top bar to keep one look instead of following whatever is behind it (the
 * story's chapters): `theme` fixes the bar's theme (the visitor's reading theme), and `bare` says
 * the bar is over the page's opening picture, where it has no background at all. A page sets it
 * when it opens and clears it when it goes. The bar reads it in `components/nav/site-nav.tsx`.
 */
export interface NavLock {
  readonly theme: "storm" | "daybreak" | null;
  readonly bare: boolean;
}

export const useNavLock = create<NavLock>()(() => ({ theme: null, bare: false }));
