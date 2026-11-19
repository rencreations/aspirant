/**
 * What the drone does while the page loads, so a waiting visitor has something to watch and is
 * never left wondering whether the site has frozen. A plain state machine: each frame it is told
 * the time, the REAL progress and the real notes (slow, offline, retrying), and it answers with at
 * most one thing to do now (a move, a face). The runtime hands the answer to the drone.
 * The drone itself already floats, blinks and looks at the pointer; this adds the little tricks on a
 * timer, a cheer at each real quarter, and a worried look when the files really have stalled.
 *
 * Nothing here moves the bar or says how far the loading is: it only reacts to what is true.
 * No three, no DOM: the whole thing is tested.
 */
import { seeded } from "../actors/duo/curves";
import type { FaceName } from "../actors/drone/faces";
import type { TrickKind } from "../actors/drone/tricks";

export interface LoaderInput {
  /** Seconds since the last frame (0 while the scene is frozen). */
  dt: number;
  /** The real progress of the waited list, 0 to 1. */
  progress: number;
  /** Everything has arrived and the gate waits for the press. */
  done: boolean;
  slow: boolean;
  offline: boolean;
  retrying: boolean;
  /** A mouse is over the page (the drone then follows it with its eyes). */
  pointerInside: boolean;
}

/** What to do this frame. Reset by every `step`. */
export interface LoaderAction {
  trick: TrickKind | null;
  face: FaceName | null;
  faceSeconds: number;
  /** A place for the eyes to wander to (stage pixels, as a fraction of the half screen), or null. */
  look: { x: number; y: number } | null;
  /** "idle", "cheer", "stall" or "offline": why, for the probes. */
  why: "idle" | "cheer" | "stall" | "offline" | "ready" | null;
}

export interface LoaderBrain {
  /** The seconds the drone has been on stage. */
  time: number;
  /** Seconds to the next idle move. */
  nextTrick: number;
  /** Seconds to the next worried look. */
  nextWorry: number;
  /** Seconds to the next glance. */
  nextGlance: number;
  lastTrick: number;
  /** The quarters that have been cheered (bit 0 is a quarter, 1 a half, 2 three quarters). */
  cheered: number;
  readyCheered: boolean;
  /** The real progress at the last change, and the seconds it has not changed. */
  lastProgress: number;
  still: number;
  /** Where the eyes wander, as fractions of the half screen. */
  wander: { x: number; y: number };
  rand: () => number;
}

/** The quarters of the real progress a cheer is made at. */
export const QUARTERS = [0.25, 0.5, 0.75] as const;

/** No new file for this long while the bar is not full: it looks stuck, and the drone says so. */
export const STILL_AFTER = 4;

interface Idle {
  trick: TrickKind;
  face: FaceName | null;
}

/** The little tricks, one every few seconds. Each is a move the drone really has. */
const IDLE: readonly Idle[] = [
  { trick: "wiggle", face: "happy" },
  { trick: "nod", face: null },
  { trick: "hop", face: "sparkle" },
  { trick: "spin", face: null },
  { trick: "roll", face: "wink" },
  { trick: "barrel", face: "laugh" },
  { trick: "frontflip", face: "proud" },
  { trick: "loop", face: "music" },
];

const CHEERS: readonly Idle[] = [
  { trick: "hop", face: "happy" },
  { trick: "backflip", face: "sparkle" },
  { trick: "barrel", face: "proud" },
];

const READY: Idle = { trick: "frontflip", face: "happy" };

export function newLoaderBrain(seed = 7): LoaderBrain {
  const rand = seeded(seed);
  return {
    time: 0,
    nextTrick: 3.2 + rand() * 1.5,
    nextWorry: 0,
    nextGlance: 1.5,
    lastTrick: -1,
    cheered: 0,
    readyCheered: false,
    lastProgress: 0,
    still: 0,
    wander: { x: 0, y: 0 },
    rand,
  };
}

export function newLoaderAction(): LoaderAction {
  return { trick: null, face: null, faceSeconds: 1.2, look: null, why: null };
}

function pickIdle(brain: LoaderBrain): Idle {
  let n = Math.floor(brain.rand() * IDLE.length);
  // Never the same move twice in a row.
  if (n === brain.lastTrick) n = (n + 1) % IDLE.length;
  brain.lastTrick = n;
  return IDLE[n] ?? IDLE[0]!;
}

function play(out: LoaderAction, what: Idle, why: LoaderAction["why"], seconds = 1.3): void {
  out.trick = what.trick;
  out.face = what.face;
  out.faceSeconds = seconds;
  out.why = why;
}

/**
 * Advance the brain by `input.dt` and write what the drone should do into `out`. Moves are never
 * asked for faster than they play (a few seconds apart), and the answer to something true (a
 * quarter reached, a stall, no connection) always wins over a trick on the timer.
 */
export function stepLoader(
  brain: LoaderBrain,
  input: LoaderInput,
  out: LoaderAction,
): LoaderAction {
  out.trick = null;
  out.face = null;
  out.look = null;
  out.why = null;
  const dt = Math.max(0, input.dt);
  brain.time += dt;
  brain.nextTrick -= dt;
  brain.nextWorry -= dt;
  brain.nextGlance -= dt;

  // The files really have stopped coming for a while.
  if (input.progress > brain.lastProgress + 1e-4) {
    brain.lastProgress = input.progress;
    brain.still = 0;
  } else if (!input.done) {
    brain.still += dt;
  }

  // 1. The truth that must show: no connection, a retry, a stall.
  if (!input.done && input.offline && brain.nextWorry <= 0) {
    brain.nextWorry = 5.5;
    out.trick = "dizzy";
    out.face = "sad";
    out.faceSeconds = 2.4;
    out.why = "offline";
    brain.nextTrick = Math.max(brain.nextTrick, 3);
    return wander(brain, input, out);
  }
  if (
    !input.done &&
    !input.offline &&
    (input.retrying || brain.still >= STILL_AFTER) &&
    brain.nextWorry <= 0
  ) {
    brain.nextWorry = 6.5;
    out.trick = "nod";
    out.face = "sweat";
    out.faceSeconds = 2.2;
    out.why = "stall";
    brain.nextTrick = Math.max(brain.nextTrick, 3);
    return wander(brain, input, out);
  }

  // 2. A cheer at each real quarter, and at the end.
  if (!input.done) {
    for (let i = 0; i < QUARTERS.length; i += 1) {
      const bit = 1 << i;
      if ((brain.cheered & bit) === 0 && input.progress >= (QUARTERS[i] ?? 2)) {
        // A quarter that was passed in one step still gets its own cheer, the earliest first.
        brain.cheered |= bit;
        play(out, CHEERS[i] ?? CHEERS[0]!, "cheer");
        brain.nextTrick = Math.max(brain.nextTrick, 2.4);
        return wander(brain, input, out);
      }
    }
  } else if (!brain.readyCheered) {
    brain.readyCheered = true;
    play(out, READY, "ready", 1.8);
    brain.nextTrick = 3.5;
    return wander(brain, input, out);
  }

  // 3. A little trick on a timer.
  if (brain.nextTrick <= 0 && !input.offline) {
    brain.nextTrick = 4.2 + brain.rand() * 2.8;
    play(out, pickIdle(brain), "idle");
  }
  return wander(brain, input, out);
}

/** The eyes wander when nobody is pointing: every few seconds they go somewhere new. */
function wander(brain: LoaderBrain, input: LoaderInput, out: LoaderAction): LoaderAction {
  if (input.pointerInside) return out;
  if (brain.nextGlance <= 0) {
    brain.nextGlance = 1.6 + brain.rand() * 2.2;
    brain.wander.x = (brain.rand() * 2 - 1) * 0.8;
    brain.wander.y = (brain.rand() * 2 - 1) * 0.55;
  }
  out.look = brain.wander;
  return out;
}
