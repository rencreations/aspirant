import { create } from "zustand";

import { audio } from "@/lib/audio";
import { useSiteStore } from "@/lib/stores";

/**
 * Asking about sound. When the sound is off and the visitor presses something that is only sound
 * (a voice line, a song), the site asks whether to turn the sound on, instead of playing it in
 * silence. The answers:
 *
 *  - turn it on: the sound is switched on and the thing plays;
 *  - keep it off: nothing plays, and the visitor is asked again the next time;
 *  - do not ask again: the old behaviour, remembered in this browser (it plays in silence).
 *
 * Things that make a sound by themselves (hover blips, voice lines on hover, the music of a
 * page) never ask: with the sound off they stay silent, as before.
 */
const NEVER_KEY = "aspirants:soundPrompt";

interface PromptState {
  open: boolean;
  /** What is about to play, for the words of the question: "This voice line". */
  what: string;
}

export const useSoundPrompt = create<PromptState>(() => ({ open: false, what: "" }));

let pending: ((ok: boolean) => void) | null = null;

function optedOut(): boolean {
  try {
    return window.localStorage.getItem(NEVER_KEY) === "never";
  } catch {
    return false;
  }
}

/** Is the sound off, and has the visitor not asked to stop being asked? */
function needsPrompt(): boolean {
  return useSiteStore.getState().muted && !optedOut();
}

function ask(what: string): Promise<boolean> {
  // One question at a time: a second press while it is open answers the first with "keep it off".
  pending?.(false);
  return new Promise<boolean>((resolve) => {
    pending = resolve;
    useSoundPrompt.setState({ open: true, what });
  });
}

/**
 * Resolves true when the sound is on (or the visitor turned it on or asked not to be asked), and
 * false when the visitor kept it off. Use it where a press leads to async work.
 */
export function ensureSound(what = "This"): Promise<boolean> {
  return needsPrompt() ? ask(what) : Promise.resolve(true);
}

/**
 * Run `run` now if the sound is on, or after the visitor turns it on. This is synchronous when no
 * question is needed, so a press still plays inside its own click, as the browser requires.
 */
export function withSound(what: string, run: () => void): void {
  if (!needsPrompt()) {
    run();
    return;
  }
  void ask(what).then((ok) => {
    if (ok) run();
  });
}

/** The visitor's answer (called by the dialog, inside the click on its button). */
export function answerSound(choice: "on" | "off" | "never"): void {
  const resolve = pending;
  pending = null;
  useSoundPrompt.setState({ open: false });
  if (choice === "on") {
    // Inside the click: audio may be started.
    audio.unlock();
    useSiteStore.getState().setMuted(false);
    audio.setMuted(false);
  } else if (choice === "never") {
    try {
      window.localStorage.setItem(NEVER_KEY, "never");
    } catch {
      // Private window: asked again next time.
    }
  }
  resolve?.(choice !== "off");
}
