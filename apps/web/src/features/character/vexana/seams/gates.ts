type Listener<T> = (value: T) => void;

/**
 * A value that one transition writes and one section (or the nav) reads, with the subscribe and get
 * that `useSyncExternalStore` wants. It remembers its value, so something that mounts after the
 * value was set (a reload part way down the page) still starts in the right place.
 */
function makeStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => value,
    set: (next: T) => {
      if (next === value) return;
      value = next;
      for (const l of listeners) l(next);
    },
    subscribe: (l: Listener<T>) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The doors of the craft have closed: the pair of faces may arrive. */
export const facesGate = makeStore(false);

/** The doors in front of the comic are opening: its words and its disc may arrive. */
export const comicsGate = makeStore(false);

/**
 * What the corner of the screen is on while a transition covers it. The doors and the liquid do not
 * take the pointer, so the nav cannot find them by looking under the corner: they say it. Null means
 * "nothing of mine is there, look at the page".
 */
export const toneHint = makeStore<"light" | "dark" | null>(null);

/** Which way a boundary between two sections is crossed. */
export type Dir = "down" | "up";

/**
 * What the section AFTER a boundary shows the boundary: the pinned box its first screen sits in
 * (a scene may move it when the visitor goes back up), the layer behind it, and the stretch of the
 * page (scroll pixels) the "up" threshold is made of.
 */
interface UpAnchors {
  held: HTMLElement;
  backdrop: HTMLElement;
  range: () => { start: number; end: number } | null;
}

/**
 * One boundary between two sections of the lower page. The section before it plays the scene (it
 * owns the scene and the "down" threshold); the section after it has the "up" threshold and asks
 * the same scene to play again, backwards in meaning, to go back. `busy` is true while it plays.
 */
interface Boundary {
  busy: boolean;
  play: ((dir: Dir) => void) | null;
  up: UpAnchors | null;
}

const boundaries = new Map<string, Boundary>();

export function boundary(id: string): Boundary {
  let b = boundaries.get(id);
  if (!b) {
    b = { busy: false, play: null, up: null };
    boundaries.set(id, b);
  }
  return b;
}
