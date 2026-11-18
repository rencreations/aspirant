/**
 * The scroll hold of the home: the wheel, the touch and the scroll keys do nothing until it is let
 * go. It is the site's own scroll lock (`seams/scroll-lock.ts`, which the shell binds here), never a
 * stop of the smooth scroller by itself. The page has no scrollbar (`BareScrollbar`), so the lock
 * never moves the layout sideways.
 *
 * Holds are counted. The site's lock is one lock: asking for it again returns the same release, so
 * two holders (a play and the preview of the aspirants, say) would let go together. Here the lock
 * is taken when the first hold starts and given back when the last one ends, and each hold has its
 * own idempotent release and its own safety timer.
 */

type Lock = (limitMs?: number) => () => void;

/** The longest a hold lasts if nobody lets it go. The caller lets it go when its scene ends. */
const HOLD_LIMIT_MS = 30_000;
/** The site's lock is asked for far longer than any hold: each hold has its own timer. */
const LOCK_LIMIT_MS = 60 * 60_000;

let bound: Lock | null = null;
let underlying: (() => void) | null = null;
const holders = new Set<() => void>();

/** The shell gives the lock it got from `useScrollLock`. Returns the way to unbind it. */
export function bindHold(lock: Lock): () => void {
  bound = lock;
  return () => {
    if (bound !== lock) return;
    bound = null;
    holders.clear();
    underlying = null;
  };
}

/** How many holds are on now (the probes and the tests). */
export function holdCount(): number {
  return holders.size;
}

/** Hold the page. Returns the release. Does nothing (and the release does nothing) when unbound. */
export function holdScroll(limitMs: number = HOLD_LIMIT_MS): () => void {
  const lock = bound;
  if (!lock) return () => undefined;
  if (holders.size === 0) underlying = lock(LOCK_LIMIT_MS);
  let timer = 0;
  const release = () => {
    if (!holders.delete(release)) return;
    window.clearTimeout(timer);
    if (holders.size === 0) {
      const give = underlying;
      underlying = null;
      give?.();
    }
  };
  holders.add(release);
  timer = window.setTimeout(release, Math.min(limitMs, LOCK_LIMIT_MS - 1000));
  return release;
}

/**
 * A move of the page that the scene must not play through (a control that took the keyboard focus
 * and moved the page to its section, a probe). The engine reads it once a frame and treats the
 * scroll as a jump until the page has arrived: no play fires, none holds.
 */
let snapRequested = false;

export function requestSnap(): void {
  snapRequested = true;
}

/** True once after `requestSnap`. */
export function takeSnap(): boolean {
  const was = snapRequested;
  snapRequested = false;
  return was;
}
