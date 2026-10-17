/** Run `callback` when the browser is idle (or after a short delay). Returns a cancel function. */
export function whenIdle(callback: () => void, timeout = 2500): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(callback, Math.min(timeout, 1200));
  return () => window.clearTimeout(handle);
}
