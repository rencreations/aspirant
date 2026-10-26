/**
 * What is particular to each page of the pair: the page of Ruby is the night shift, the page of
 * Angela is the first sunrise. Everything here comes from the sources (see `content/characters/`
 * and `story/CANON-NOTES.md` section 12.3); where they are silent nothing is written.
 */
export type Who = "ruby" | "angela";

export const WHO: readonly Who[] = ["ruby", "angela"];

export function isWho(value: string): value is Who {
  return value === "ruby" || value === "angela";
}

export interface DuoCopy {
  /** The name of the page, which is also the time of day. */
  mood: string;
  /** The line under the name in the hero. */
  hint: string;
  /** The same hint for a touch screen. */
  hintTouch: string;
  /** What the hero says about the second picture. */
  layerName: string;
  /** Label of the film section. */
  filmLabel: string;
  /** Label of the voice section and its idle line. */
  voiceLabel: string;
  voiceIdle: string;
  /** Label of the log (the telling of who she is). */
  logLabel: string;
  /** The page of her partner: the words on the button. */
  switchLabel: string;
  switchLine: string;
}

export const COPY: Record<Who, DuoCopy> = {
  ruby: {
    mood: "Night shift",
    hint: "Move over the art. It is drawn in two inks.",
    hintTouch: "Touch the art. It is drawn in two inks.",
    layerName: "Blueprint",
    filmLabel: "Reel",
    voiceLabel: "Keys",
    voiceIdle: "Press a key. Forty lines are loaded.",
    logLabel: "Change log",
    switchLabel: "Switch to the day shift",
    switchLine: "Angela is awake. She is waiting for the sun.",
  },
  angela: {
    mood: "First sunrise",
    hint: "Move over the art. Press and hold to feel the warmth.",
    hintTouch: "Touch the art. Hold your finger down to feel the warmth.",
    layerName: "Warmth map",
    filmLabel: "Memory",
    voiceLabel: "Say it again",
    voiceIdle: "Pick a line. Tetra is listening.",
    logLabel: "Diary",
    switchLabel: "Switch to the night shift",
    switchLine: "Ruby is still at her bench. The light is on.",
  },
};

/** The lines of the terminal in Ruby's hero: a command, and what it answers (all from her sources). */
export const RUBY_TERMINAL: ReadonlyArray<{ cmd: string; out: string }> = [
  { cmd: "who_am_i", out: "Ruby. Heir of Oro. Programmer." },
  { cmd: "rules.load()", out: "An heir shall not have friends." },
  { cmd: "workshop.build(angela)", out: "Done. Cat-ear headset. Soft face." },
  { cmd: "freedom.status", out: "Not given up. Not on any road." },
];

/** The voice lines Tetra reads out in Angela's hero (numbers from `audio/angela/voice.md`). */
export const TETRA_LINES: readonly number[] = [2, 17, 21, 28];

/**
 * The exchange of the trailer, one beat at a time (`story/CANON-NOTES.md` section 12.3). The page
 * lets the visitor step through it; the speaker's side lights up and the pulse travels along the
 * tether to the other.
 */
export interface Beat {
  who: Who;
  text: string;
}

export const DUET: readonly Beat[] = [
  { who: "ruby", text: "Does it hurt?" },
  { who: "angela", text: "What does hurt mean?" },
  {
    who: "ruby",
    text: "I'm Ruby, don't you remember? We've been together since the very beginning.",
  },
  { who: "ruby", text: "I don't want freedom at the cost of you!" },
  { who: "ruby", text: "I think I know what hurt means now. I'm... hurting. How do I stop it?" },
  { who: "angela", text: "Ruby!" },
];

/** The place of the face of each, in the splash art, for the round portraits (percent from the top left). */
export const FACE: Record<Who, { x: number; y: number; zoom: number }> = {
  ruby: { x: 44, y: 29, zoom: 3.2 },
  angela: { x: 59.5, y: 23, zoom: 3.4 },
};

/** Where Tetra is in Angela's splash art, for her small round picture. */
export const TETRA_AT = { x: 30.5, y: 42, zoom: 4.4 };

/** The seconds into the film of each still of the strip (see `scripts/ruby-angela/build.py`). */
export const FRAME_SECONDS: Record<Who, readonly number[]> = {
  ruby: [4, 16, 32, 48, 64, 84, 92, 108],
  angela: [12, 28, 32, 36, 52, 56, 68, 80],
};

export const PARTNER: Record<Who, Who> = { ruby: "angela", angela: "ruby" };

export const NAMES: Record<Who, string> = { ruby: "Ruby", angela: "Angela" };

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
