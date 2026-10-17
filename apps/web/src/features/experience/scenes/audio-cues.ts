import type { Slug } from "@/content/types";

/**
 * Voice lines played at story beats. A cue fires when its paragraph has stayed lit for a moment
 * (see useSceneAudio), once per visit, only after the visitor entered and unlocked sound.
 * Each line was matched by hand against `voice.md` and the paragraph it sits on: only lines
 * that say what the story says at that moment. (There is no recorded "Does it hurt?" and no
 * recorded "I'm here"; those beats stay visual.)
 */
export interface VoiceCue {
  slug: Slug;
  /** Line number in `audio/voice/{slug}/NN.m4a`. */
  n: number;
  /** The recorded line's English translation, for reference and tests. */
  line: string;
}

export const VOICE_CUES: Readonly<Record<string, VoiceCue>> = {
  "c02-p000": { slug: "fanny", n: 2, line: "Off we go, toward a free world!" },
  "c03-p021": { slug: "layla", n: 8, line: "This is my secret base. Don't tell anyone." },
  "c12-p014": { slug: "obsidia", n: 4, line: "That's enough recalibration." },
  "c14-p034": { slug: "lesley", n: 3, line: "There's no time to lament." },
  "c18-p003": { slug: "change", n: 36, line: "I hate scary Big Sis!" },
  "c18-p040": { slug: "obsidia", n: 5, line: "Enders, withdraw!" },
  "c21-p046": {
    slug: "change",
    n: 11,
    line: "With Mr. Bunny and me, even 1 plus 1 is bigger than 2.",
  },
  "c21-p059": {
    slug: "lesley",
    n: 36,
    line: "Chang'e, ever since that day, I vowed to protect you.",
  },
  "c27-p025": {
    slug: "obsidia",
    n: 16,
    line: "Out of pure curiosity, I added one more pawn to the board.",
  },
  "c28-p015": { slug: "lesley", n: 37, line: "Don't make me do this. Chang'e..." },
  "c29-p004": { slug: "lesley", n: 28, line: "Switching to stealth mode." },
  "c35-p034": {
    slug: "angela",
    n: 18,
    line: "I feel warmth. But why? There's no reaction at all in my cooling system.",
  },
  "c39-p029": { slug: "ruby", n: 19, line: "No... I'm not anyone's puppet." },
  "c42-p023": { slug: "obsidia", n: 4, line: "That's enough recalibration." },
  "c48-p040": { slug: "vexana", n: 14, line: "For the sake of the Aspirant spirit, I will lie." },
  "c51-p052": { slug: "obsidia", n: 2, line: "Let us begin the final purge." },
  "c53-p001": { slug: "obsidia", n: 6, line: "The Matrix is transmitting." },
  "c54-p039": { slug: "angela", n: 40, line: "How can I fly even without wings?" },
  "c58-p006": { slug: "obsidia", n: 35, line: "It has been a while, my little doll." },
  "c58-p012": { slug: "selena", n: 39, line: "It's been a while, my dear creator." },
  "c58-p029": {
    slug: "selena",
    n: 44,
    line: "Sorry to say, but I still like life at the academy better.",
  },
  "c58-p036": { slug: "selena", n: 34, line: "Here comes the lightning." },
  "c59-p028": { slug: "obsidia", n: 32, line: "Sleep, in the cradle of the void." },
};

/** Public path of a cue's audio file (pass it through `asset()`). */
export function cueFile(cue: VoiceCue): string {
  return `/audio/voice/${cue.slug}/${String(cue.n).padStart(2, "0")}.m4a`;
}
