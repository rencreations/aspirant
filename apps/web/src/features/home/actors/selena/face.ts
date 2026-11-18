/**
 * Her face. The head mesh carries fifteen shapes (the notes' `morphs`), each an absolute shape
 * that adds to the others, and the actor splits the blink into a left and a right half so she can
 * wink. An expression is a preset: a few shape weights. The face blends toward the preset by an
 * amount from 0 to 1, a one-shot reaction rides on top and always finishes, the mouth wobbles while
 * she talks, and she blinks by herself. Pure: the weights go out as one array, the actor writes
 * them to the mesh.
 *
 * Every preset is strong on purpose: at 120 px tall her face is a few pixels, so an expression
 * must still read there, and at 600 px it must not look broken (no preset adds more than two
 * mouth shapes).
 */
import { approach, clamp, makeRandom, smoothstep } from "./motion";

export const MORPH_NAMES = [
  "blink",
  "wince_open",
  "strain",
  "shout",
  "laugh",
  "smile_closed",
  "smile",
  "smile_soft",
  "angry",
  "angry_shout",
  "snarl",
  "surprised",
  "lips_pursed",
  "mouth_o",
  "mouth_tiny_o",
  "wink_l",
  "wink_r",
] as const;

export type Morph = (typeof MORPH_NAMES)[number];

export type Expression =
  | "neutral"
  | "soft"
  | "smile"
  | "happy"
  | "content"
  | "laugh"
  | "shout"
  | "surprised"
  | "angry"
  | "snarl"
  | "rage"
  | "pout"
  | "ouch"
  | "effort"
  | "wink"
  | "sleepy";

type Weights = Partial<Record<Morph, number>>;

export const PRESETS: Readonly<Record<Expression, Weights>> = {
  neutral: {},
  soft: { smile_soft: 1 },
  smile: { smile: 1 },
  happy: { smile: 0.75, smile_soft: 0.5 },
  content: { smile_closed: 1 },
  laugh: { laugh: 1 },
  shout: { shout: 1 },
  surprised: { surprised: 1, mouth_tiny_o: 0.25 },
  angry: { angry: 1 },
  snarl: { snarl: 1 },
  rage: { angry_shout: 1 },
  pout: { lips_pursed: 1 },
  ouch: { wince_open: 1 },
  effort: { strain: 1 },
  wink: { wink_r: 1, smile: 0.7 },
  sleepy: { blink: 0.8, smile_soft: 0.6 },
};

/** The shapes that close the eyes by themselves: a blink on top of them would double the lids. */
const CLOSERS: Weights = {
  blink: 1,
  wince_open: 1,
  strain: 1,
  laugh: 1,
  smile_closed: 1,
  smile: 0.35,
  wink_l: 0.5,
  wink_r: 0.5,
};

/** How fast a shape follows its target, per second. */
const FOLLOW = 13;

export class Face {
  /** The weights to draw, one per name in `MORPH_NAMES`. */
  readonly weights = new Float32Array(MORPH_NAMES.length);
  private readonly shown = new Float32Array(MORPH_NAMES.length);
  private readonly target = new Float32Array(MORPH_NAMES.length);
  private base: Expression = "neutral";
  private amount = 1;
  private reaction: Expression | null = null;
  private reactionLeft = 0;
  private reactionLength = 1;
  private talkLevel = 0;
  private talkShown = 0;
  private nextBlink = 1.8;
  private blinkAt = -1;
  private blinkTwice = false;
  private clock = 0;
  private readonly random: () => number;

  constructor(seed = 20261118) {
    this.random = makeRandom(seed);
  }

  /** The expression she holds. `amount` 0 is neutral, 1 is the full preset. A section sets it every frame. */
  set(name: Expression, amount = 1): void {
    this.base = name;
    this.amount = clamp(amount, 0, 1);
  }

  /** A one-shot expression on top, for `seconds`: it rises fast, holds, and always lets go. */
  react(name: Expression, seconds: number): void {
    this.reaction = name;
    this.reactionLength = Math.max(0.2, seconds);
    this.reactionLeft = this.reactionLength;
  }

  /** The mouth moves as if she spoke, 0 (shut) to 1 (lively). */
  talk(level: number): void {
    this.talkLevel = clamp(level, 0, 1);
  }

  /** Blink now (a section can time it). */
  blinkNow(): void {
    this.blinkAt = this.clock;
    this.blinkTwice = false;
  }

  /** The one-shot reaction that is running, or null. */
  reacting(): Expression | null {
    return this.reactionLeft > 0 ? this.reaction : null;
  }

  /** Advance by `dt` seconds and fill `weights`. A `dt` of 0 leaves everything where it is. */
  step(dt: number): Float32Array {
    if (dt > 0) this.advance(dt);
    return this.weights;
  }

  private advance(dt: number): void {
    this.clock += dt;
    const t = this.target;
    t.fill(0);
    this.addPreset(this.base, this.amount);
    if (this.reaction && this.reactionLeft > 0) {
      this.reactionLeft = Math.max(0, this.reactionLeft - dt);
      // A quick rise, a hold, a slower fall.
      const x = 1 - this.reactionLeft / this.reactionLength;
      const env = smoothstep(x / 0.12) * (1 - smoothstep((x - 0.7) / 0.3));
      this.addPreset(this.reaction, env);
    }
    this.addTalk(dt);

    const k = approach(FOLLOW, dt);
    for (let i = 0; i < t.length; i += 1) {
      this.shown[i] = this.shown[i]! + (t[i]! - this.shown[i]!) * k;
    }
    // The blink is not smoothed (it has its own curve) and is cut by shapes that close the eyes.
    let closed = 0;
    for (let k = 0; k < CLOSER_INDEX.length; k += 1) {
      closed += this.shown[CLOSER_INDEX[k]!]! * CLOSER_WEIGHT[k]!;
    }
    const open = 1 - clamp(closed, 0, 1);
    const blink = this.blinkValue() * open;
    for (let i = 0; i < this.weights.length; i += 1) this.weights[i] = this.shown[i]!;
    const b = indexOf("blink");
    this.weights[b] = clamp(this.weights[b]! + blink, 0, 1);
  }

  private addPreset(name: Expression, scale: number): void {
    const preset = PRESETS[name];
    for (const key of Object.keys(preset) as Morph[]) {
      const i = indexOf(key);
      this.target[i] = this.target[i]! + (preset[key] ?? 0) * scale;
    }
  }

  private addTalk(dt: number): void {
    this.talkShown += (this.talkLevel - this.talkShown) * approach(10, dt);
    const level = this.talkShown;
    if (level < 0.01) return;
    const c = this.clock;
    const wave = 0.5 + 0.5 * Math.sin(c * 19) * (0.6 + 0.4 * Math.sin(c * 7.3 + 1));
    const o = indexOf("mouth_o");
    const tiny = indexOf("mouth_tiny_o");
    this.target[o] = this.target[o]! + level * wave * 0.8;
    this.target[tiny] = this.target[tiny]! + level * (1 - wave) * 0.5;
  }

  /** 0 (open) to 1 (shut) from the blink clock: a quick close, a slower open, sometimes twice. */
  private blinkValue(): number {
    if (this.blinkAt < 0) {
      if (this.clock >= this.nextBlink) {
        this.blinkAt = this.clock;
        this.blinkTwice = this.random() < 0.18;
      }
      return 0;
    }
    const age = this.clock - this.blinkAt;
    const close = 0.07;
    const open = 0.14;
    const one = close + open;
    const gap = 0.08;
    const shape = (a: number): number =>
      a < close ? a / close : Math.max(0, 1 - (a - close) / open);
    let v = 0;
    if (age < one) v = shape(age);
    else if (this.blinkTwice && age < one + gap) v = 0;
    else if (this.blinkTwice && age < 2 * one + gap) v = shape(age - one - gap);
    else {
      this.blinkAt = -1;
      this.nextBlink = this.clock + 2.4 + this.random() * 3.4;
      return 0;
    }
    return smoothstep(v);
  }
}

const INDEX = new Map<string, number>(MORPH_NAMES.map((name, i) => [name, i]));

export function indexOf(name: Morph): number {
  return INDEX.get(name) ?? 0;
}

/** The closers as two flat arrays, so a frame does not make a list of entries. */
const CLOSER_INDEX: number[] = (Object.keys(CLOSERS) as Morph[]).map((name) => indexOf(name));
const CLOSER_WEIGHT: number[] = (Object.keys(CLOSERS) as Morph[]).map((name) => CLOSERS[name] ?? 0);
