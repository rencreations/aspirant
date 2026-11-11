/**
 * One IntersectionObserver per margin, shared by every tile. A tile asks to be told when it comes
 * within a margin of the screen (a part of the screen height) and when it leaves again. The tile
 * list is long, and a tile is cheap until it is near.
 */
type Callback = (inside: boolean) => void;

interface Watcher {
  observer: IntersectionObserver;
  calls: Map<Element, Callback>;
}

const watchers = new Map<string, Watcher>();

function watcherFor(margin: string): Watcher {
  let found = watchers.get(margin);
  if (!found) {
    const calls = new Map<Element, Callback>();
    const observer = new IntersectionObserver(
      (entries) => {
        // The latest entry of an element is the one that counts.
        const last = new Map<Element, boolean>();
        for (const entry of entries) last.set(entry.target, entry.isIntersecting);
        last.forEach((inside, el) => {
          calls.get(el)?.(inside);
        });
      },
      { rootMargin: margin, threshold: 0 },
    );
    found = { observer, calls };
    watchers.set(margin, found);
  }
  return found;
}

/** Call `callback(true)` when `el` is within `margin` of the screen and `callback(false)` when it is not. Returns the way to stop. */
export function watchNear(el: Element, margin: string, callback: Callback): () => void {
  const { observer, calls } = watcherFor(margin);
  calls.set(el, callback);
  observer.observe(el);
  return () => {
    calls.delete(el);
    observer.unobserve(el);
  };
}

/** Pictures that arrived and showed once: a tile that stands again shows them with no fade. */
const shown = new Set<string>();
const LIMIT = 600;

export function noteShown(url: string): void {
  if (shown.size >= LIMIT) shown.clear();
  shown.add(url);
}

export function wasShown(url: string): boolean {
  return shown.has(url);
}
