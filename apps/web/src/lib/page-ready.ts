/**
 * A tiny registry that lets a page say "do not open the curtain yet". A component with a slow
 * first paint (a WebGL scene waiting for its textures) calls `expectReady` when it mounts and
 * the returned `mark` when it is showing something. The loading screen and the page transition
 * wait for every expectation, so the page opens fully drawn.
 *
 * This is about drawing, not about the network: it runs after every file has arrived (the loading
 * list waits for them as long as it takes). The cap is only a safety valve for a component that
 * can never report (a video decoder that will not start until a tap), so it is long.
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

/** The longest the curtain waits for the page to draw itself once every file is in. */
const READY_MAX_MS = 30_000;

/**
 * Resolve when nothing is pending (checked twice, 80 ms apart, so components that register a
 * moment after mount are seen), or after `maxMs` (30 s unless a test asks for less).
 */
export function whenPageReady(maxMs = READY_MAX_MS): Promise<void> {
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
