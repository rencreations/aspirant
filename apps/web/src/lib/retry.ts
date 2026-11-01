import { whenOnline } from "@/lib/offline";

/**
 * A file the loading screen needs is never given up on because the connection is slow or bad.
 * A failed or stalled download is tried again, with a short wait that grows to ten seconds, for as
 * long as it takes (while offline the next try waits for the connection to return).
 *
 * The one exception is a failure that no retry can fix: the server says the file does not exist
 * (HTTP 404 or 410), or the file arrives whole and cannot be decoded again and again. That item is
 * skipped and logged, so one missing file cannot hold every visitor at the loading screen for ever.
 */
export class PermanentFailure extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "PermanentFailure";
    this.status = status;
  }
}

/** The HTTP statuses that mean the file is gone for good. */
export function isGone(status: number): boolean {
  return status === 404 || status === 410;
}

const FIRST_DELAY_MS = 1000;
const MAX_DELAY_MS = 10_000;

/** How long to wait after the `n`th failure (0 based): 1 s, 2 s, 4 s, 8 s, then 10 s. */
function retryDelay(n: number): number {
  return Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** Math.min(n, 10));
}

let retrying = 0;
const listeners = new Set<() => void>();

/** How many downloads are between a failed try and the next one right now. */
export function retriesWaiting(): number {
  return retrying;
}

/** Call `fn` whenever `retriesWaiting` may have changed. Returns the way to stop. */
export function onRetries(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function changed(by: number): void {
  retrying += by;
  listeners.forEach((fn) => {
    fn();
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Run `attempt` until it succeeds. A `PermanentFailure` ends it (the caller skips the item); any
 * other failure waits and tries again. `attempt` gets the number of the try, from 0.
 */
export async function untilItArrives<T>(attempt: (n: number) => Promise<T>): Promise<T> {
  for (let n = 0; ; n += 1) {
    try {
      return await attempt(n);
    } catch (error) {
      if (error instanceof PermanentFailure) throw error;
      changed(1);
      try {
        await pause(retryDelay(n));
        await whenOnline();
      } finally {
        changed(-1);
      }
    }
  }
}
