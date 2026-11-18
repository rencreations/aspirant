/**
 * How the drone answers a visitor who presses it. Pure and on its own clock, so a section that
 * keeps the drone in one place (the loader) still gets a drone that reacts: an answer never moves
 * the drone's target, it only asks for a move (`tricks.ts`), a face and a bubble.
 *
 *  - the first presses are friendly: a hop, a roll, a nod, each with its own bubble;
 *  - three quick presses make it dizzy, the fourth puzzles it ("?");
 *  - the fifth in a short while makes it annoyed: an angry face, a bang and a shake, and more
 *    presses keep it annoyed for a little longer (to a limit);
 *  - when the visitor stops and a moment has gone by, it forgives: a nod, a heart and a kind face.
 *
 * No three here.
 */
import type { FaceName } from "./faces";
import type { IconName } from "./marks";
import type { TrickKind } from "./tricks";

type Mood = "calm" | "annoyed" | "forgiving";

export interface Reactions {
  /** The times, in seconds, of the presses of the last few moments. */
  presses: number[];
  /** Where in the friendly answers the next one is. */
  answer: number;
  mood: Mood;
  /** When the annoyance, or the forgiveness, ends. */
  until: number;
  /** When the annoyance began. */
  started: number;
}

/** What the drone should do, if `fired`. */
export interface Answer {
  fired: boolean;
  trick: TrickKind | null;
  icon: IconName | null;
  /** A face to wear for `faceSeconds`, or null. */
  face: FaceName | null;
  faceSeconds: number;
}

/** Presses this close together count as quick, in seconds. */
export const WINDOW = 2.4;
export const DIZZY_AT = 3;
export const PUZZLED_AT = 4;
export const ANNOYED_AT = 5;
/** The annoyance holds this long after the last press, in seconds, at most `ANNOYED_MAX` in all. */
const ANNOYED_HOLD = 1.8;
export const ANNOYED_MAX = 6;
const FORGIVE_SECONDS = 1.8;

const FRIENDLY_TRICKS: readonly TrickKind[] = ["hop", "roll", "nod"];
const FRIENDLY_ICONS: readonly IconName[] = ["heart", "sparkle", "smile"];

export function createReactions(): Reactions {
  return { presses: [], answer: 0, mood: "calm", until: 0, started: 0 };
}

export function createAnswer(): Answer {
  return { fired: false, trick: null, icon: null, face: null, faceSeconds: 0 };
}

function clear(out: Answer): Answer {
  out.fired = false;
  out.trick = null;
  out.icon = null;
  out.face = null;
  out.faceSeconds = 0;
  return out;
}

/** The visitor pressed the drone at `now` (seconds). */
export function press(r: Reactions, now: number, out: Answer): Answer {
  clear(out);
  out.fired = true;
  let kept = 0;
  for (const t of r.presses) {
    if (now - t < WINDOW) r.presses[kept++] = t;
  }
  r.presses.length = kept;
  r.presses.push(now);
  const count = r.presses.length;

  if (r.mood === "forgiving") r.mood = "calm";

  if (r.mood === "annoyed") {
    r.until = Math.min(r.started + ANNOYED_MAX, now + ANNOYED_HOLD);
    out.trick = "shake";
    out.icon = "bang";
    out.face = "angry";
    out.faceSeconds = 1.2;
    return out;
  }
  if (count >= ANNOYED_AT) {
    r.mood = "annoyed";
    r.started = now;
    r.until = now + ANNOYED_HOLD;
    out.trick = "shake";
    out.icon = "bang";
    out.face = "angry";
    out.faceSeconds = 1.4;
    return out;
  }
  if (count === PUZZLED_AT) {
    out.icon = "question";
    out.face = "confused";
    out.faceSeconds = 1;
    return out;
  }
  if (count === DIZZY_AT) {
    out.trick = "dizzy";
    return out;
  }
  const at = r.answer % FRIENDLY_TRICKS.length;
  out.trick = FRIENDLY_TRICKS[at] ?? "hop";
  out.icon = FRIENDLY_ICONS[at] ?? "heart";
  out.face = "happy";
  out.faceSeconds = 1;
  r.answer += 1;
  return out;
}

/** The clock: an annoyance that has run its time turns into forgiveness. Call it once a frame. */
export function stepReactions(r: Reactions, now: number, out: Answer): Answer {
  clear(out);
  if (r.mood === "annoyed" && now >= r.until) {
    r.mood = "forgiving";
    r.until = now + FORGIVE_SECONDS;
    r.presses.length = 0;
    out.fired = true;
    out.trick = "nod";
    out.icon = "heart";
    out.face = "thanks";
    out.faceSeconds = FORGIVE_SECONDS * 0.9;
  } else if (r.mood === "forgiving" && now >= r.until) {
    r.mood = "calm";
  }
  return out;
}

/** The drone is put back as it was (hidden and shown again): no memory of the last visit's presses. */
export function resetReactions(r: Reactions): void {
  r.presses.length = 0;
  r.mood = "calm";
  r.until = 0;
  r.started = 0;
}
