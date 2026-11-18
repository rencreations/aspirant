import type { Actor, Actors } from "../../kernel/types";

/**
 * Several sections use one actor (Silverbolt, the doll, the drone). The first section that needs it
 * builds it, the others find it. `ensureActor` makes that safe: a build that is still running is
 * shared, and a build that fails is not remembered. The key is the registry itself, so a second
 * engine (React's double effect in development) starts clean.
 */
const building = new WeakMap<Actors, Map<string, Promise<Actor>>>();

export function ensureActor<T extends Actor>(
  actors: Actors,
  name: string,
  build: () => Promise<T> | T,
): Promise<T> {
  const have = actors.get(name);
  if (have) return Promise.resolve(have as T);
  let map = building.get(actors);
  if (!map) {
    map = new Map();
    building.set(actors, map);
  }
  const running = map.get(name);
  if (running) return running as Promise<T>;
  const made = (async () => {
    const actor = await build();
    // The registry refuses a second actor of one name: the build that arrives first wins.
    const late = actors.get(name);
    if (late) {
      actor.dispose?.();
      return late as T;
    }
    return actors.register(actor);
  })();
  const forget = (): void => {
    map.delete(name);
  };
  made.then(forget, forget);
  map.set(name, made);
  return made;
}
