/**
 * The scroll hold of the home: the wheel, the touch and the scroll keys do nothing until it is let
 * go. It is the site's own scroll lock (`seams/scroll-lock.ts`, which the shell binds here) with a
 * long safety limit, never a stop of the smooth scroller by itself. The page has no scrollbar
 * (`BareScrollbar`), so the lock never moves the layout sideways.
 */

type Lock = (limitMs?: number) => () => void;

/** The longest a hold lasts if nobody lets it go. The caller lets it go when its scene ends. */
const HOLD_LIMIT_MS = 30_000;

let bound: Lock | null = null;

/** The shell gives the lock it got from `useScrollLock`. Returns the way to unbind it. */
export function bindHold(lock: Lock): () => void {
  bound = lock;
  return () => {
    if (bound === lock) bound = null;
  };
}

/** Hold the page. Returns the release. Does nothing (and the release does nothing) when unbound. */
export function holdScroll(limitMs: number = HOLD_LIMIT_MS): () => void {
  return bound ? bound(limitMs) : () => undefined;
}
