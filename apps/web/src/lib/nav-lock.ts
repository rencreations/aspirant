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
  /**
   * The brand logo is hidden (it fades by opacity) but keeps its space, so nothing in the bar
   * moves and the logo's rect can still be measured. The home page sets it while its own big logo
   * stands in the middle of the screen and later morphs into the bar's logo. The brand link is
   * inert while it is set.
   */
  readonly hideLogo: boolean;
  /**
   * The menu button, the sound button, the record widget and the page name are hidden (opacity
   * only) and inert. The bar keeps its layout. The home page sets it until its opening has ended.
   */
  readonly hideControls: boolean;
}

export const useNavLock = create<NavLock>()(() => ({
  theme: null,
  bare: false,
  fade: false,
  away: false,
  hideLogo: false,
  hideControls: false,
}));

/** The path with its slashes at the end taken off, `/` for the home page. */
function normalPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Should the home's two hiding fields be cleared when the path becomes `pathname`? Yes, for every
 * page but the home. The bar (`components/nav/site-nav.tsx`) asks this on every path change and does
 * not wait for the home page to unmount, so `/about` and the rest never open with an empty bar. On
 * the home page itself it says no, so a page that has just set the fields in the same commit keeps them.
 */
export function shouldClearHomeNav(pathname: string): boolean {
  const path = normalPath(pathname);
  return path !== "/" && path !== "/index.html";
}

/** Show the logo and the controls again. Changes nothing (and wakes nobody) when they are shown. */
export function clearHomeNav(): void {
  const { hideLogo, hideControls } = useNavLock.getState();
  if (!hideLogo && !hideControls) return;
  useNavLock.setState({ hideLogo: false, hideControls: false });
}
