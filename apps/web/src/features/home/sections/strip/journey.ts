/**
 * The strip (screens 8.2 to 11.3, tail 1.2): the psychoactive hero. The small ultra wide frame with
 * its words, the expand to the window, the pull into the floating previews and the hold with the
 * words of "Official animations", then the whole set flying off to the bottom right in the tail.
 * Pure functions of `s`, the scroll in screens from the start of the section (negative in the lead),
 * so a jump lands exactly. The numbers are the reference's (digest `ref-psychoactive-tib.md` 1.6 and
 * 1.7) scaled to the scroll of this page: the expand is 0.8 of a screen (the reference's 703 px of
 * 900), the pull 0.6, the hold 0.6.
 */
import { clamp, ramp, smootherstep } from "../../fx/image-field/math";

/** The beats, in screens from the start of the section. */
export const STRIP_BEATS = {
  /** The words, the line and the dots of the small frame come in (the lead of the section). */
  enter: [-0.4, 0.2],
  /** The frame grows to the window and the small words leave. */
  expand: [0.45, 1.25],
  /** The play button and its two words come in on the window. */
  window: [1.15, 1.45],
  /** The window becomes the leader of the orbit and the ten previews arrive. */
  pull: [1.5, 2.1],
  /** The orbit holds under the words of the second screen. */
  hold: [2.1, 2.7],
  /** Everything leaves to the bottom right (the tail of the section). */
  fly: [2.7, 3.7],
} as const;

/**
 * The story position (screens from the section's start) of the strip's virtual `local` `v` (the four
 * plays of `index.ts`). 0 to 1 (a scroll zone) only brings the small words in, 1 to 2 (a trigger) expands
 * the frame to the window, 2 to 3 (a trigger) pulls it into the orbit of the ten films, 3 to 4 (a scroll
 * zone) is the fly-off. Each station rests in a frame that every beat function holds still: the small state
 * from 0.2 to 0.45, the window at 1.5, the orbit at 2.7, the end at 3.7. Outside 0 to 4 it rests.
 */
export function stripS(v: number): number {
  const x = clamp(v, 0, 4);
  const B = STRIP_BEATS;
  // The words come in across the first zone, by the scroll (the rows' zone before it has ended with the
  // film upright, so nothing slides under them).
  if (x <= 1) return B.enter[0] + (B.enter[1] - B.enter[0]) * x;
  if (x <= 2) return B.expand[0] + (B.pull[0] - B.expand[0]) * (x - 1);
  if (x <= 3) return B.pull[0] + (B.fly[0] - B.pull[0]) * (x - 2);
  return B.fly[0] + (B.fly[1] - B.fly[0]) * (x - 3);
}

/** The orbit's turn from the scroll, radians per screen (the reference: two slots of twelve per hold). */
const TRAVEL_RATE = 2.1;

export interface StripBeats {
  /** 0 to 1: the small frame's words and chrome come in. */
  enter: number;
  /** 0 to 1: the small words leave as the frame grows (power1.out). */
  leave: number;
  /** 0 the strip, 1 the window (power1.out, the reference's own curve). */
  expand: number;
  /** 0 the strip's effects overlay, 1 the clean film: the overlay "slowly disappears". */
  clean: number;
  /** 0 to 1: the play button and its words are in. */
  windowIn: number;
  pull: number;
  hold: number;
  fly: number;
  /** 0 to 1: how much of the words of "Official animations" is in (they come in by random letters, as the reference's). */
  textIn: number;
  /** 1 to 0: the floating play button's scale (it goes as the pull starts). */
  play: number;
  /** The orbit's turn from the scroll, radians, 0 where the pull ends. */
  travel: number;
}

export function makeBeats(): StripBeats {
  return {
    enter: 0,
    leave: 0,
    expand: 0,
    clean: 0,
    windowIn: 0,
    pull: 0,
    hold: 0,
    fly: 0,
    textIn: 0,
    play: 1,
    travel: 0,
  };
}

const easeOut = (x: number): number => 1 - (1 - x) * (1 - x);

/** Every beat at `s`. Writes `out` and returns it (nothing is allocated). */
export function stripBeats(s: number, out: StripBeats): StripBeats {
  const B = STRIP_BEATS;
  out.enter = ramp(s, B.enter[0], B.enter[1]);
  const p = ramp(s, B.expand[0], B.expand[1]);
  out.expand = easeOut(p);
  out.leave = easeOut(ramp(p, 0, 0.6));
  out.clean = smootherstep(ramp(p, 0.1, 0.85));
  out.windowIn = ramp(s, B.window[0], B.window[1]);
  out.pull = ramp(s, B.pull[0], B.pull[1]);
  out.hold = ramp(s, B.hold[0], B.hold[1]);
  out.fly = ramp(s, B.fly[0], B.fly[1]);
  // The reference: the words follow the pull from 0.65 (to 0.4) and the hold (to 1 at 0.6 of it), and
  // leave in the first third of the fly-off (so they are gone before the next section's joint).
  const e = ramp(out.pull, 0.65, 1) * 0.4 + ramp(out.hold, 0, 0.6) * 0.6;
  out.textIn = clamp(e * (1 - ramp(out.fly, 0, 0.3)));
  const q = ramp(out.pull, 0.04, 0.2);
  out.play = 1 - q * q * (3 - 2 * q);
  out.travel = TRAVEL_RATE * (s - B.hold[0]);
  return out;
}

/**
 * How much of the live light overlay the trailer wears (0 to 1): it comes on as the film turns upright
 * (with the strip's own overlay), is a little softer on the open window, and fades out gradually as
 * the strip is left (the exit: the set flying off to the next section). A pure function of the beats.
 */
export function overlayAmount(morph: number, expand: number, fly: number): number {
  const on = smootherstep(ramp(morph, 0.35, 1));
  return on * (1 - 0.4 * clamp(expand)) * (1 - ramp(fly, 0, 0.75));
}

/**
 * Whether letter `i` of `n` has come in at `progress` (0 to 1). Each letter has its own moment, taken
 * at random from a fixed seed, so the words appear letter by letter in no order and leave the same way
 * when the visitor scrolls back (the reference's SplitText, scrubbed by the scroll). `spread` is how
 * much of the progress the moments are spread over.
 */
export function letterIn(i: number, progress: number, spread = 0.8, salt = 0): boolean {
  return progress > letterMoment(i, salt) * spread;
}

/** A letter's own moment, 0 to 1: a fixed hash of its place, the same on every load and every frame. */
export function letterMoment(i: number, salt = 0): number {
  let h = Math.imul(i + 1 + salt * 977, 2654435761) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 1000) / 1000;
}
