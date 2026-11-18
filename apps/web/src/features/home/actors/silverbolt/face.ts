/**
 * Faces. Silverbolt has no brows and no lids, only two almond eyes (squash them to blink), a jaw,
 * two cheek blades and a crest. An expression is therefore not carried by the eyes alone (at 120 px
 * tall an eye is 3 px): it is the eye slant and squash, the jaw, the head's dip and tilt, the glow
 * and tint of the crystals, how fast it breathes and how hard the tail lashes. A face is one
 * `FaceState`; the presets are blended by a 0..1 weight, and the blink is a separate envelope that
 * closes whatever lids the face asks for.
 */
import { clamp, lerp } from "./math";

export interface FaceState {
  /** How open the eyes are: 1 is normal, 0 shut, above 1 wide (surprise). */
  lid: number;
  /** The slant of the eyes in radians: positive lowers the inner ends (angry). Negative lifts them (sad). */
  slant: number;
  /** The jaw, 0 (shut) to 1 (wide). The modelled mouth is `JAW_REST_OPEN`. */
  jaw: number;
  /** The head's nod: positive dips the nose (a scowl), negative lifts it (proud, surprised). */
  headDip: number;
  /** The head's roll (a tilt of curiosity), radians. */
  headTilt: number;
  /** The crystals' glow, 1 is as drawn. */
  glow: number;
  /** 0 to 1: the eyes and crystals go hot (red). */
  anger: number;
  /** How fast it breathes, 1 is calm. */
  breath: number;
  /** 0 to 1: the tail lashes. */
  lash: number;
  /** The cheek blades flare out (0 to 1). */
  flare: number;
}

/** The jaw as modelled (angle 0) in the 0..1 scale of `FaceState.jaw`: (0 - closed) / (wide - closed). */
export const JAW_REST_OPEN = 0.3 / 1.3;

export type FaceName =
  "neutral" | "smile" | "annoyed" | "surprised" | "content" | "growl" | "proud" | "sleepy";

const base: FaceState = {
  lid: 1,
  slant: 0,
  jaw: JAW_REST_OPEN,
  headDip: 0,
  headTilt: 0,
  glow: 1,
  anger: 0,
  breath: 1,
  lash: 0,
  flare: 0,
};

function make(over: Partial<FaceState>): FaceState {
  return { ...base, ...over };
}

export const FACES: Readonly<Record<FaceName, FaceState>> = {
  neutral: make({}),
  // A grin: the eyes squint up into crescents, the mouth opens a little, the head lifts, the glow is bright.
  smile: make({
    lid: 0.5,
    slant: -0.18,
    jaw: 0.55,
    headDip: -0.12,
    headTilt: 0.15,
    glow: 1.5,
    flare: 0.2,
  }),
  // Narrow, slanted eyes, a shut mouth, the head down, hot crystals, fast breath, the tail lashes.
  annoyed: make({
    lid: 0.42,
    slant: 0.42,
    jaw: 0.02,
    headDip: 0.22,
    glow: 1.5,
    anger: 1,
    breath: 2.4,
    lash: 1,
    flare: 1,
  }),
  surprised: make({
    lid: 1.3,
    slant: -0.1,
    jaw: 0.5,
    headDip: -0.1,
    glow: 1.6,
    flare: 1,
    breath: 1.6,
  }),
  // Eyes shut in bliss, a small smile.
  content: make({
    lid: 0.1,
    slant: -0.12,
    jaw: 0.3,
    headDip: 0.05,
    headTilt: -0.1,
    glow: 0.9,
    breath: 0.7,
  }),
  growl: make({
    lid: 0.5,
    slant: 0.45,
    jaw: 0.65,
    headDip: 0.2,
    glow: 1.7,
    anger: 1,
    breath: 2.8,
    lash: 1,
    flare: 1,
  }),
  proud: make({ lid: 0.7, slant: -0.05, jaw: 0.3, headDip: -0.14, glow: 1.2, flare: 0.5 }),
  sleepy: make({ lid: 0.22, slant: -0.05, jaw: 0.2, headDip: 0.12, glow: 0.7, breath: 0.6 }),
};

/** `out = lerp(a, b, t)` for every field. */
export function blendFace(out: FaceState, a: FaceState, b: FaceState, t: number): FaceState {
  const w = clamp(t, 0, 1);
  out.lid = lerp(a.lid, b.lid, w);
  out.slant = lerp(a.slant, b.slant, w);
  out.jaw = lerp(a.jaw, b.jaw, w);
  out.headDip = lerp(a.headDip, b.headDip, w);
  out.headTilt = lerp(a.headTilt, b.headTilt, w);
  out.glow = lerp(a.glow, b.glow, w);
  out.anger = lerp(a.anger, b.anger, w);
  out.breath = lerp(a.breath, b.breath, w);
  out.lash = lerp(a.lash, b.lash, w);
  out.flare = lerp(a.flare, b.flare, w);
  return out;
}

/** A fresh neutral face (the actor keeps a few and reuses them). */
export function neutralFace(): FaceState {
  return { ...base };
}

/**
 * The blink envelope: how shut the eyes are (0 open, 1 shut) `age` seconds after a blink started.
 * It closes in 0.05 s, holds 0.03 s and opens in 0.09 s. It is 0 after 0.17 s.
 */
export function blinkAt(age: number): number {
  if (age < 0 || age >= 0.17) return 0;
  if (age < 0.05) return age / 0.05;
  if (age < 0.08) return 1;
  return 1 - (age - 0.08) / 0.09;
}

/**
 * The automatic blinker. Every 2 to 5.5 seconds the eyes blink, and now and then (one in five)
 * twice. `rng` is `Math.random` in the actor and a fixed sequence in the tests. `scale` makes it
 * faster when the dragon is annoyed (shorter gaps).
 */
export class Blinker {
  private age = 99;
  private wait: number;
  private double = false;

  constructor(private readonly rng: () => number = Math.random) {
    this.wait = 1 + this.rng() * 2;
  }

  /** Advance `dt` seconds; returns the closure 0..1. */
  step(dt: number, rate = 1): number {
    this.age += dt;
    this.wait -= dt * rate;
    if (this.wait <= 0) {
      this.age = 0;
      if (this.double) {
        this.double = false;
        this.wait = 2 + this.rng() * 3.5;
      } else if (this.rng() < 0.2) {
        this.double = true;
        this.wait = 0.28;
      } else {
        this.wait = 2 + this.rng() * 3.5;
      }
    }
    return blinkAt(this.age);
  }

  /** Blink now (a reaction: a poke makes it flinch). */
  now(): void {
    this.age = 0;
  }
}
