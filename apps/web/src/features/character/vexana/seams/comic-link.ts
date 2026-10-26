import { perfLevel } from "@/lib/perf";

import type { DoorHooks } from "./door-gate";
import { speedFor } from "./door-math";
import { toneHint } from "./gates";

/**
 * What the comic offers the two joins around it: the doors between the interlude and the comic
 * (`DoorGate` with dark doors), and the join between the comic and the livestream (`DoorGate` with
 * clear doors: the comic's own halves are the doors there). The comic registers itself while it is
 * mounted (`registerComic`); the joins speak to it through the hooks below.
 */
export interface ComicApi {
  /**
   * Whatever the pointer chose gives way (the halves, the words and the disc go back to neutral) and
   * nothing takes the pointer. Resolves when it has (about a fifth of a second), or at once with
   * `wait` false.
   */
  calm: (wait?: boolean) => Promise<void>;
  /** The pointer may choose again. */
  release: () => void;
  /** The stage is fixed to the screen (so the page can jump under it) or back in the page. */
  pin: (on: boolean) => void;
  /** What shows of the arrival: nothing, the disc alone (it came in with its half), or everything. */
  show: (what: "nothing" | "disc" | "all") => void;
  /** The two halves slide out (to the sides, the disc with the Watch half) and resolve when gone. */
  slideOut: (seconds: number) => Promise<void>;
  /** The two halves slide in over what is under them and resolve when they have met. */
  slideIn: (seconds: number) => Promise<void>;
  /** Plays the entrance (the words, the disc, the sticker) and resolves when everything is in. */
  enter: () => Promise<void>;
  /** The picture at rest: halves in place, nothing pinned, everything shown, the pointer free. */
  rest: () => void;
  /** Resolves when the pictures of the comic are decoded, so they do not pop in as the doors open. */
  decoded: () => Promise<void>;
}

let comic: ComicApi | null = null;

/** Called by the comic when it mounts; the returned function takes it away again. */
export function registerComic(api: ComicApi): () => void {
  comic = api;
  return () => {
    if (comic === api) comic = null;
  };
}

/** The speed of a scene of this device (a weak one plays them shorter). */
const speed = () => speedFor(perfLevel());

/** The seconds the halves take to slide, before the performance level shortens them. */
const SLIDE_SECONDS = 0.95;

/**
 * The doors between the interlude (above) and the comic (below). Down: the comic arrives (its words,
 * its disc and its sticker come in by time as the doors open). Up: the comic is left behind the
 * closing doors. The comic is shown at rest to a page that is opened on it.
 */
export const interludeComicHooks: DoorHooks = {
  // Going up, the comic is under the closing doors: let the pointer's choice go, without waiting.
  leave: (dir) => (dir === "up" ? comic?.calm(false) : undefined),
  ready: (dir) => (dir === "down" ? comic?.decoded() : undefined),
  // The screen is covered: going down the comic is put to nothing so its entrance can play as the
  // doors open (and the visitor sees it arrive, not the end of it).
  covered: (dir) => {
    if (dir === "down") {
      comic?.rest();
      comic?.show("nothing");
    }
  },
  arrival: (dir) => (dir === "down" ? comic?.enter() : undefined),
  settle: (side) => {
    if (side === "after") {
      comic?.show("all");
      comic?.rest();
    } else {
      comic?.show("nothing");
    }
  },
};

/**
 * The join between the comic (above) and the livestream (below), made by the comic's halves. Down:
 * the pointer's choice is let go, the stage is fixed to the screen, the page goes to the livestream
 * under it, and the two halves slide out to the two sides, the whole disc with the Watch half: they
 * open on the livestream. Up: the stage is fixed with its halves out of sight, they slide in over the
 * livestream and meet, the page goes to the comic and the stage goes back into the page, and then
 * the words and the sticker come in by time.
 */
export const comicStreamHooks: DoorHooks = {
  leave: async (dir) => {
    toneHint.set("dark");
    if (dir === "down") {
      await comic?.calm();
      comic?.pin(true);
      return;
    }
    // Going up: what is shown on the halves is the disc alone; they come in with it.
    await comic?.calm(false);
    comic?.show("disc");
    comic?.pin(true);
    void comic?.slideOut(0);
    await comic?.slideIn(SLIDE_SECONDS * speed());
  },
  covered: (dir) => {
    // The page has gone to the comic: the stage goes back into the page, in the place it was fixed
    // to, so nothing moves.
    if (dir === "up") comic?.pin(false);
  },
  arrival: async (dir) => {
    if (dir === "down") {
      await comic?.slideOut(SLIDE_SECONDS * speed());
      comic?.pin(false);
      return;
    }
    await comic?.enter();
    comic?.release();
  },
  settle: (side) => {
    // The page is at rest on the comic's side (or above it): the comic is as it is meant to be seen.
    if (side === "before") {
      comic?.rest();
    }
  },
};
