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
