/**
 * Run `run` when the page is idle, and at the latest after `timeoutMs`. Building an actor (parsing
 * a model, compiling its programs, sending its pictures to the GPU) is one long task of a few
 * hundred milliseconds: it is cheap to put it between two scroll events, where a still scene hides
 * it, and costly in the middle of a scroll. Safari has no idle callback: a short timer stands in.
 */
export function whenIdle(run: () => void, timeoutMs: number): void {
  const w = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: timeoutMs });
  } else {
    window.setTimeout(run, 60);
  }
}
