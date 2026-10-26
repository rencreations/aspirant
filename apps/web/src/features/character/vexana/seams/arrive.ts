import { useSyncExternalStore } from "react";

/**
 * "This section has arrived": a transition throws the switch when it has finished covering the
 * screen and the section under it is about to show, and the section plays its own entrance by
 * time (not by scroll). A reload part way down the page starts it on the right side.
 */
function makeSwitch(initial: boolean) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: boolean) => {
      if (next === value) return;
      value = next;
      for (const l of listeners) l();
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The liquid has covered the screen: the film may fade in. */
export const filmArrive = makeSwitch(false);

/** The cream heart has shut over the music film: her section may show itself. */
export const guinevereArrive = makeSwitch(false);

/** Reads a switch as a React value (false on the server). */
export function useSwitch(s: ReturnType<typeof makeSwitch>) {
  return useSyncExternalStore(s.subscribe, s.get, () => false);
}
