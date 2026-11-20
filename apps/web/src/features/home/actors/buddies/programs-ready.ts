import type { WebGLRenderer } from "three";

/** A program of the renderer. `isReady` is three's own (it reads the driver's completion flag). */
interface Linking {
  isReady?: () => boolean | null;
}

/** How long to wait at most: a lost context never finishes a link, and the page must not hold for it. */
const GIVE_UP_MS = 30_000;
const POLL_MS = 40;

/**
 * Resolves when every program the renderer has made so far has finished linking in the driver.
 *
 * `renderer.compile` only starts a link (the driver does it on its own thread). The first frame that
 * draws the program then asks for its result and waits for it on the main thread: the toon face of the
 * doll takes seconds on a cold shader cache, and the whole page froze for that long in the middle of the
 * strip's exit, the moment the drone and the doll first showed (round nine). A pair that is shown only
 * after this resolves never makes the first frame wait. A browser without the parallel compile
 * extension reports every program ready at once (three's own rule).
 */
export function programsReady(
  renderer: WebGLRenderer,
  isGone: () => boolean = () => false,
): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = (): void => {
      if (isGone() || performance.now() - t0 > GIVE_UP_MS) {
        resolve();
        return;
      }
      let ready = true;
      try {
        const list = renderer.info.programs as readonly Linking[] | null;
        for (const program of list ?? []) {
          if (program.isReady && !program.isReady()) {
            ready = false;
            break;
          }
        }
      } catch {
        // A lost context: nothing to wait for.
      }
      if (ready) resolve();
      else setTimeout(check, POLL_MS);
    };
    check();
  });
}
