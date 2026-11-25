/**
 * The way the page's exit hook reaches the footer's runtime. `kernel/handoff.ts` is a client module
 * (it uses the router), and the footer's runtime is a lazy chunk that the server's module graph also
 * walks, where a client module may not be imported. So the hook is set by a small client component
 * (`exit-hook.tsx`) that calls whatever is in here, and the runtime puts its own exit in here while it
 * is mounted. Empty (nothing to wait for) when the runtime is not there.
 */
export const exitBridge: {
  run: (() => Promise<void>) | null;
  /**
   * The scene has reached the end of the page too (it can be a little behind the page on a hard
   * scroll): the way to About by the scroll waits for it, so the drone and the hairline finish first.
   */
  settled: (() => boolean) | null;
} = { run: null, settled: null };
