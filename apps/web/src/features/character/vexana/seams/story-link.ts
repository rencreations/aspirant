import type { DoorHooks } from "./door-gate";

/**
 * What the pair of faces (the story) offers the doors in front of it. The pair registers itself
 * while it is mounted (`registerStory`); the doors between the craft and the story speak to it
 * through `storyHooks`, which is what `DoorGate` takes as its `hooks`.
 */
export interface StoryApi {
  /** Plays the entrance from nothing. Resolves when everything is in view and can be pressed. */
  enter: () => Promise<void>;
  /** Shows the finished entrance at once: the page was opened below the doors, or flung past them. */
  enterNow: () => void;
  /** The figures and words leave to the left and right, and the ground is left plain. Resolves when gone. */
  exit: () => Promise<void>;
  /** Back to nothing on screen, so the entrance can play again. */
  reset: () => void;
  /** Resolves when the two figures are decoded, so they do not pop in as the doors open. */
  decoded: () => Promise<void>;
}

let story: StoryApi | null = null;

/** Called by the pair when it mounts; the returned function takes it away again. */
export function registerStory(api: StoryApi): () => void {
  story = api;
  return () => {
    if (story === api) story = null;
  };
}

/** The doors between the craft (above) and the story (below). Down: the story arrives. Up: it leaves. */
export const storyHooks: DoorHooks = {
  leave: (dir) => (dir === "up" ? story?.exit() : undefined),
  ready: (dir) => (dir === "down" ? story?.decoded() : undefined),
  // The screen is covered: the pair is put to nothing (going down) so it can come in, or (going back
  // up) after it has left. Its entrance starts when the doors begin to open (`arrival`), so the
  // visitor sees it arrive and not the end of it.
  covered: () => {
    story?.reset();
  },
  arrival: (dir) => (dir === "down" ? story?.enter() : undefined),
  settle: (side) => {
    if (side === "after") story?.enterNow();
    else story?.reset();
  },
};
