/**
 * When to do a heavy step (parsing a model, linking programs, a first draw) without a visitor feeling
 * it: when they have not scrolled or pressed anything for a moment, and between two frames. A step
 * that waits for a quiet moment never waits for ever: a visitor who keeps scrolling is given the step
 * after `maxWaitMs`, because the page is about to need it.
 */

/** A visitor is quiet when nothing has moved the page for this long. */
export const QUIET_MS = 320;
/** The longest a step waits for a quiet moment. */
export const QUIET_MAX_MS = 2200;

/** True when the last input was at least `quietMs` before `now`. Pure, for the tests. */
export function isQuiet(now: number, lastInput: number, quietMs: number = QUIET_MS): boolean {
  return now - lastInput >= quietMs;
}

let lastInput = -1e9;
let listening = false;
const INPUTS = ["wheel", "touchmove", "touchstart", "keydown", "scroll", "pointerdown"] as const;

function mark(): void {
  lastInput = performance.now();
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  for (const name of INPUTS) window.addEventListener(name, mark, { passive: true, capture: true });
}

/**
 * Resolve at a quiet moment: no wheel, touch, key or scroll for `QUIET_MS`, or after `maxWaitMs`.
 * Polls twice a second at most, so it costs nothing while it waits.
 */
export function whenQuiet(maxWaitMs: number = QUIET_MAX_MS): Promise<void> {
  listen();
  const started = performance.now();
  return new Promise((resolve) => {
    const check = (): void => {
      const now = performance.now();
      if (isQuiet(now, lastInput) || now - started >= maxWaitMs) {
        // Land between two frames, not in the middle of one.
        requestAnimationFrame(() => {
          resolve();
        });
        return;
      }
      window.setTimeout(check, 120);
    };
    check();
  });
}

/** The next animation frame, or 40 ms later where there are none (a hidden tab). */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(resolve, 40);
    requestAnimationFrame(() => {
      window.clearTimeout(id);
      resolve();
    });
  });
}

/**
 * Resolve when the GPU has finished everything issued so far, without blocking the page: a fence
 * that is asked about once a frame. A first draw of a program asks the driver for its link log, and
 * that call waits for the GPU's whole queue (uploads and compiles included): taken after a drain,
 * it costs a millisecond. Gives up after `capMs` (a lost context never signals).
 */
export function gpuDrained(gl: WebGL2RenderingContext, capMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    let sync: WebGLSync | null = null;
    try {
      sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    } catch {
      sync = null;
    }
    if (!sync) {
      resolve();
      return;
    }
    const started = performance.now();
    const poll = (): void => {
      let done = true;
      try {
        done =
          gl.isContextLost() ||
          gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED ||
          performance.now() - started > capMs;
        if (done && !gl.isContextLost()) gl.deleteSync(sync);
      } catch {
        done = true;
      }
      if (done) resolve();
      else void nextFrame().then(poll);
    };
    poll();
  });
}
