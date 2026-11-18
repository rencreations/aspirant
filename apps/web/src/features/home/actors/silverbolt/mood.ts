/**
 * The moods of Silverbolt as pure state: the annoyed meter that rises when it is poked too much,
 * and the one-shot reactions (a shake, a puff, a flutter, a chomp, a flinch) that are timed inside
 * the actor and always finish. Nothing here knows about three.js.
 */
import { clamp } from "./math";

export interface AnnoyOptions {
  /** The level lost per second when nobody pokes. */
  decay: number;
  /** How long it stays annoyed once the meter is full, in seconds. */
  hold: number;
  /** The most a long teasing can stretch the hold to. */
  holdMax: number;
  /** Where the meter drops to when the annoyed state ends. */
  after: number;
}

export const ANNOY: AnnoyOptions = { decay: 0.07, hold: 4.5, holdMax: 8, after: 0.3 };

/**
 * Poke it and it gets annoyed: every poke adds to a meter, the meter drains slowly, and when it is
 * full the dragon is annoyed for a few seconds (more pokes extend that, up to a limit), then it
 * calms down and the meter starts low so the next teasing does not take long.
 */
export class AnnoyMeter {
  level = 0;
  annoyed = false;
  /** Seconds left of the annoyed state. */
  left = 0;
  /** Increments when the state starts: a listener can tell one outburst from the next. */
  outbursts = 0;

  constructor(private readonly options: AnnoyOptions = ANNOY) {}

  poke(amount: number): void {
    if (this.annoyed) {
      this.left = Math.min(this.options.holdMax, this.left + amount * 2);
      return;
    }
    this.level = clamp(this.level + amount, 0, 1);
    if (this.level >= 1) {
      this.annoyed = true;
      this.left = this.options.hold;
      this.outbursts += 1;
    }
  }

  step(dt: number): void {
    if (this.annoyed) {
      this.left -= dt;
      if (this.left <= 0) {
        this.annoyed = false;
        this.left = 0;
        this.level = this.options.after;
      }
      return;
    }
    this.level = Math.max(0, this.level - this.options.decay * dt);
  }

  /** 0 to 1 for the face: the level counts for half, the outburst for all. */
  anger(): number {
    return this.annoyed ? 1 : this.level * 0.5;
  }

  reset(): void {
    this.level = 0;
    this.annoyed = false;
    this.left = 0;
  }
}

export type ReactionKind = "shake" | "puff" | "flutter" | "chomp" | "flinch" | "yelp";

const KINDS: readonly ReactionKind[] = ["shake", "puff", "flutter", "chomp", "flinch", "yelp"];

/** How long each reaction lasts, in seconds. */
export const REACTION_LENGTH: Readonly<Record<ReactionKind, number>> = {
  shake: 1.1,
  puff: 0.9,
  flutter: 1.8,
  chomp: 0.34,
  flinch: 0.8,
  yelp: 0.6,
};

/**
 * The value of a reaction `age` seconds after it started, for a strength 1. `shake` and `flinch`
 * are signed oscillations that fade, `puff` a growing then settling pulse (signed: it overshoots),
 * `flutter` and `yelp` an envelope from 0 to 1 and back, `chomp` the jaw: 0 to 1 and shut again.
 */
export function reactionValue(kind: ReactionKind, age: number): number {
  const length = REACTION_LENGTH[kind];
  if (age < 0 || age >= length) return 0;
  switch (kind) {
    case "shake":
      return Math.exp(-age * 4.2) * Math.sin(age * Math.PI * 2 * 7.5);
    case "puff":
      return Math.exp(-age * 5.5) * Math.sin(age * Math.PI * 2 * 3);
    case "flutter":
      return Math.min(1, age / 0.08) * Math.exp(-age * 2.2);
    case "chomp": {
      if (age < 0.09) return age / 0.09;
      if (age < 0.15) return 1;
      return Math.max(0, 1 - (age - 0.15) / 0.19);
    }
    case "flinch":
      return Math.exp(-age * 6) * Math.sin(age * Math.PI * 2 * 4);
    case "yelp":
      return Math.sin((age / length) * Math.PI);
  }
}

/** The running reactions. One of each kind at a time: a new one restarts it. */
export class Reactions {
  private readonly age: Record<ReactionKind, number> = {
    shake: -1,
    puff: -1,
    flutter: -1,
    chomp: -1,
    flinch: -1,
    yelp: -1,
  };
  private readonly strength: Record<ReactionKind, number> = {
    shake: 1,
    puff: 1,
    flutter: 1,
    chomp: 1,
    flinch: 1,
    yelp: 1,
  };
  /** The side a flinch goes to (-1 or 1). */
  flinchSide = 1;

  trigger(kind: ReactionKind, strength = 1): void {
    this.age[kind] = 0;
    this.strength[kind] = strength;
  }

  step(dt: number): void {
    for (const kind of KINDS) {
      if (this.age[kind] < 0) continue;
      this.age[kind] += dt;
      if (this.age[kind] >= REACTION_LENGTH[kind]) this.age[kind] = -1;
    }
  }

  value(kind: ReactionKind): number {
    return reactionValue(kind, this.age[kind]) * this.strength[kind];
  }

  active(kind: ReactionKind): boolean {
    return this.age[kind] >= 0;
  }

  /** 1 when the reaction starts, falling to 0 when it ends (0 when it is not running). */
  remaining(kind: ReactionKind): number {
    const age = this.age[kind];
    return age < 0 ? 0 : 1 - age / REACTION_LENGTH[kind];
  }

  clear(): void {
    for (const kind of KINDS) this.age[kind] = -1;
  }
}
