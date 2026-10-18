/**
 * A tiny registry that lets a page say "do not open the curtain yet". A component with a slow
 * first paint (a WebGL scene waiting for its textures) calls `expectReady` when it mounts and
 * the returned `mark` when it is showing something. The loading screen and the page transition
 * wait for every expectation, with a cap, so the page opens fully drawn.
 *
 *   useEffect(() => { const mark = expectReady("home-hero"); ...; return mark; }, []);
 */
const pending = new Set<string>();

/** Register a pending item. Call the returned function once the item is ready. Safe to repeat. */
export function expectReady(id: string): () => void {
  pending.add(id);
  return () => {
    pending.delete(id);
  };
}

/**
 * Resolve when nothing is pending (checked twice, 80 ms apart, so components that register a
 * moment after mount are seen), or after `maxMs`.
 */
export function whenPageReady(maxMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const started = performance.now();
    let calm = 0;
    const tick = () => {
      if (pending.size === 0) calm += 1;
      else calm = 0;
      if (calm >= 2 || performance.now() - started > maxMs) {
        resolve();
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
  });
}
