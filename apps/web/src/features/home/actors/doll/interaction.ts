/**
 * What the doll does when the visitor touches her, as a small state machine with no three.js in it.
 * Every reaction is a one-shot with a fixed length: it always finishes and lands on rest.
 *
 *  - hover: she looks at the cursor (the actor does that) and gives a small hop;
 *  - press: a squeak face (shocked, angry or dizzy, picked at random), a spin about her own axis
 *    and a squash and stretch;
 *  - spam (`SPAM_COUNT` presses within `SPAM_WINDOW` seconds): dizzy, spirals and a wobbling head
 *    for `DIZZY_SECONDS`.
 */
import { Spring, clamp } from "./motion";

import type { FaceName } from "./face/presets";

export const HOP_SECONDS = 0.34;
export const SQUEAK_SECONDS = 0.95;
export const DIZZY_SECONDS = 2.6;
export const SPAM_COUNT = 3;
export const SPAM_WINDOW = 1.5;
/** The squeak faces a press picks from. */
export const SQUEAKS: readonly FaceName[] = ["shocked", "angry", "dizzy"];

export type ReactionKind = "hover" | "press" | "dizzy";

export interface ReactionOut {
  /** 0 to 1 over the hop: the actor lifts her by a share of her height. */
  hop: number;
  /** The extra yaw of the spin, in radians. */
  spin: number;
  /** Squash and stretch, -1 (flat) to 1 (tall), small. */
  squash: number;
  /** The head's roll wobble, -1 to 1. */
  wobble: number;
  /** A face to hold, or null to leave the face to the section. */
  face: FaceName | null;
  /** Something reacted (hover, press, dizzy): true for the frame it began. */
  began: ReactionKind | null;
}

export class Reactions {
  private hopT = HOP_SECONDS;
  private squeakT = SQUEAK_SECONDS;
  private dizzyT = DIZZY_SECONDS;
  private squeakFace: FaceName = "shocked";
  private readonly presses: number[] = [];
  private clock = 0;
  private spinTarget = 0;
  private readonly spin = new Spring(11, 0.85);
  private readonly pop = new Spring(22, 0.32);
  private readonly shake = new Spring(16, 0.14);
  private began: ReactionKind | null = null;

  readonly out: ReactionOut = { hop: 0, spin: 0, squash: 0, wobble: 0, face: null, began: null };

  /** The pointer came onto her. */
  enter(): void {
    this.hopT = 0;
    this.pop.kick(-2.4);
    this.began = "hover";
  }

  /** A press on her. `random` is 0 to 1 (a parameter so a test can choose). */
  press(random: number): void {
    this.squeakFace =
      SQUEAKS[Math.min(SQUEAKS.length - 1, Math.floor(random * SQUEAKS.length))] ?? "shocked";
    this.squeakT = 0;
    this.spinTarget += Math.PI * 2;
    this.pop.kick(5.5);
    this.shake.kick(7);
    this.hopT = 0;
    this.began = "press";
    this.presses.push(this.clock);
    while (this.presses.length > 0 && this.clock - (this.presses[0] ?? 0) > SPAM_WINDOW)
      this.presses.shift();
    if (this.presses.length >= SPAM_COUNT && this.dizzyT >= DIZZY_SECONDS) {
      this.dizzyT = 0;
      this.shake.kick(14);
      this.began = "dizzy";
    }
  }

  /** True while any reaction is running. */
  get busy(): boolean {
    return (
      this.hopT < HOP_SECONDS ||
      this.squeakT < SQUEAK_SECONDS ||
      this.dizzyT < DIZZY_SECONDS ||
      Math.abs(this.spin.x - this.spinTarget) > 0.01
    );
  }

  /** Step by `dt` seconds. Returns the same object each time. */
  update(dt: number): ReactionOut {
    const d = clamp(dt, 0, 0.1);
    this.clock += d;
    this.hopT = Math.min(HOP_SECONDS, this.hopT + d);
    this.squeakT = Math.min(SQUEAK_SECONDS, this.squeakT + d);
    this.dizzyT = Math.min(DIZZY_SECONDS, this.dizzyT + d);
    this.spin.step(this.spinTarget, d);
    this.pop.step(0, d);
    this.shake.step(0, d);
    // Once the spin has landed on a whole number of turns, forget them so the angle never grows.
    if (
      this.spinTarget > 0 &&
      Math.abs(this.spin.x - this.spinTarget) < 0.002 &&
      Math.abs(this.spin.v) < 0.01
    ) {
      this.spin.reset(0);
      this.spinTarget = 0;
    }
    const o = this.out;
    o.hop = this.hopT < HOP_SECONDS ? Math.sin((this.hopT / HOP_SECONDS) * Math.PI) : 0;
    o.spin = this.spin.x;
    o.squash = clamp(this.pop.x, -0.3, 0.3);
    // A dizzy doll sways for the whole of it, the shake spring adds the kick.
    const sway =
      this.dizzyT < DIZZY_SECONDS
        ? Math.sin(this.dizzyT * 7.5) * (1 - this.dizzyT / DIZZY_SECONDS)
        : 0;
    o.wobble = clamp(this.shake.x * 0.2 + sway * 0.7, -1, 1);
    if (this.dizzyT < DIZZY_SECONDS) o.face = "dizzy";
    else if (this.squeakT < SQUEAK_SECONDS) o.face = this.squeakFace;
    else o.face = null;
    o.began = this.began;
    this.began = null;
    return o;
  }
}
