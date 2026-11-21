/**
 * How the pair answers the pointer, pure (round six). The drone's body and the doll's body are two
 * hit targets; their hover, press and release come in here with the time, and `step` gives back
 * the one-shots to fire this frame (a trick, a face, the shock mark) and writes the continuing part of
 * the answer into a `PairCue`:
 *
 *  - hover on the drone: it perks up and the doll waves at the cursor;
 *  - hover on the doll: she smiles and waves, the drone looks up at her;
 *  - press the drone: a trick (a spin, or a rock) while she holds on and cheers;
 *  - press the doll: she giggles and hugs its head, the drone wiggles happily;
 *  - two presses within 0.4 s: a big move together (a hop with a spin, arms up);
 *  - press and hold: both lean toward the cursor (`lean`, 0 to 1, the pair knows which way);
 *  - a spree of presses: dizzy, then they laugh it off.
 */
import { clearCue, type PairCue } from "./choreo";
import type { FaceName as DollFace } from "../doll/face/presets";
import type { FaceName as DroneFace } from "../drone/faces";
import type { TrickKind } from "../drone/tricks";

export type TouchTarget = "drone" | "doll";
type Reaction =
  | "perk"
  | "waveAtCursor"
  | "cheer"
  | "giggle"
  | "big"
  | "dizzy"
  | "laugh"
  | "startle"
  | "hug"
  | "wave"
  | "hop"
  | "wiggle"
  | "spin";

export interface TouchOut {
  fired: boolean;
  droneTrick: TrickKind | null;
  dir: number;
  droneFace: DroneFace | null;
  dollFace: DollFace | null;
  faceSeconds: number;
  shock: boolean;
}

export function createTouchOut(): TouchOut {
  return {
    fired: false,
    droneTrick: null,
    dir: 1,
    droneFace: null,
    dollFace: null,
    faceSeconds: 1,
    shock: false,
  };
}

/** The length of each reaction, seconds. */
export const LENGTH: Readonly<Record<Reaction, number>> = {
  perk: 1.5,
  waveAtCursor: 1.8,
  cheer: 1.6,
  giggle: 1.9,
  big: 2.2,
  dizzy: 2.4,
  laugh: 1.8,
  startle: 1.2,
  hug: 2.0,
  wave: 2.0,
  hop: 1.0,
  wiggle: 1.6,
  spin: 1.0,
};

/** Presses this close together are a double press, and a spree is this many within `SPREE_WINDOW`. */
const DOUBLE = 0.4;
const SPREE_AT = 4;
const SPREE_WINDOW = 2.2;
/** A press held this long is a hold, and the lean grows over `HOLD_RAMP`. */
const HOLD_AFTER = 0.28;
const HOLD_RAMP = 0.5;

const smooth = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
const bump = (u: number): number => Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 2;
const TAU = Math.PI * 2;

export class Touch {
  /** Who the pointer is over, who is held, and when. */
  private over: TouchTarget | null = null;
  private held: TouchTarget | null = null;
  private heldAt = 0;
  private current: Reaction | null = null;
  private startedAt = 0;
  private presses: number[] = [];
  private count = 0;
  private lean = 0;
  private lastHoverAt = -10;
  private pending: { name: Reaction; who: TouchTarget | null } | null = null;

  /** How much they lean toward the cursor, 0 to 1. */
  get leaning(): number {
    return this.lean;
  }
  get active(): string | null {
    return this.current;
  }

  reset(): void {
    this.over = null;
    this.held = null;
    this.current = null;
    this.presses.length = 0;
    this.lean = 0;
    this.pending = null;
  }

  hover(who: TouchTarget | null, now: number): void {
    if (who && who !== this.over && now - this.lastHoverAt > 2.5) {
      this.lastHoverAt = now;
      this.start(who === "drone" ? "perk" : "waveAtCursor", now);
    }
    this.over = who;
  }

  press(who: TouchTarget, now: number): void {
    this.held = who;
    this.heldAt = now;
    let kept = 0;
    for (const t of this.presses) if (now - t < SPREE_WINDOW) this.presses[kept++] = t;
    this.presses.length = kept;
    const last = this.presses[this.presses.length - 1];
    this.presses.push(now);
    this.count += 1;
    if (this.presses.length >= SPREE_AT) {
      this.presses.length = 0;
      this.start("dizzy", now, true);
      return;
    }
    if (last !== undefined && now - last < DOUBLE) {
      this.start("big", now, true);
      return;
    }
    this.start(who === "drone" ? "cheer" : "giggle", now, true);
  }

  release(now: number): void {
    void now;
    this.held = null;
  }

  /** A cue asked for by name (a section, a probe). */
  cue(name: Reaction | "cheer", now: number): void {
    this.start(name, now, true);
  }

  private start(name: Reaction, now: number, force = false): void {
    if (this.current && !force) {
      // A hover does not cut a reaction that has not run out.
      if (now - this.startedAt < LENGTH[this.current]) return;
    }
    this.current = name;
    this.startedAt = now;
    this.pending = { name, who: this.over };
  }

  /** One frame. Writes the one-shots into `out` and the continuing part of the answer into `cue`. */
  step(dt: number, now: number, out: TouchOut, cue?: PairCue): TouchOut {
    out.fired = false;
    out.droneTrick = null;
    out.droneFace = null;
    out.dollFace = null;
    out.shock = false;
    // The hold: both lean toward the cursor while a press lasts.
    const holding = this.held !== null && now - this.heldAt > HOLD_AFTER;
    this.lean += ((holding ? 1 : 0) - this.lean) * (1 - Math.exp(-dt / (HOLD_RAMP / 3)));
    if (this.pending) {
      this.fire(this.pending.name, now, out);
      this.pending = null;
    }
    if (this.current && now - this.startedAt >= LENGTH[this.current]) {
      const done = this.current;
      this.current = null;
      if (done === "dizzy") {
        // The dizziness ends in a laugh.
        this.current = "laugh";
        this.startedAt = now;
        this.fire("laugh", now, out);
      }
    }
    if (cue) this.write(now, cue);
    return out;
  }

  /** The one-shots of a reaction at its start. */
  private fire(name: Reaction, now: number, o: TouchOut): void {
    o.fired = true;
    o.dir = this.count % 2 === 0 ? 1 : -1;
    switch (name) {
      case "perk":
        o.droneTrick = "hop";
        o.droneFace = "happy";
        o.dollFace = "grin";
        o.faceSeconds = 1.2;
        break;
      case "waveAtCursor":
        o.droneFace = "happy";
        o.dollFace = "grin";
        o.faceSeconds = 1.4;
        break;
      case "cheer":
        o.droneTrick = this.count % 3 === 0 ? "roll" : "spin";
        o.droneFace = "happy";
        o.dollFace = "laughing";
        o.faceSeconds = 1.3;
        break;
      case "giggle":
        o.droneTrick = "wiggle";
        o.droneFace = "heart";
        o.dollFace = "laughing";
        o.faceSeconds = 1.6;
        break;
      case "big":
        o.droneTrick = "hop";
        o.droneFace = "sparkle";
        o.dollFace = "laughing";
        o.faceSeconds = 1.8;
        break;
      case "dizzy":
        o.droneTrick = "dizzy";
        o.droneFace = "dizzy";
        o.dollFace = "dizzy";
        o.faceSeconds = LENGTH.dizzy * 0.9;
        break;
      case "laugh":
        o.droneTrick = "wiggle";
        o.droneFace = "laugh";
        o.dollFace = "laughing";
        o.faceSeconds = 1.6;
        break;
      case "startle":
        o.droneTrick = "nod";
        o.droneFace = "shocked";
        o.dollFace = "shocked";
        o.shock = true;
        break;
      case "hug":
        o.droneFace = "heart";
        o.dollFace = "heartEyes";
        o.faceSeconds = 1.8;
        break;
      case "wave":
        o.droneFace = "happy";
        o.dollFace = "grin";
        o.faceSeconds = 1.6;
        break;
      case "hop":
        o.droneTrick = "hop";
        break;
      case "wiggle":
        o.droneTrick = "wiggle";
        o.dollFace = "laughing";
        break;
      case "spin":
        o.droneTrick = "spin";
        break;
    }
    void now;
  }

  /** The continuing part: the doll's hands and body for the reaction that runs. */
  private write(now: number, c: PairCue): void {
    clearCue(c);
    const r = this.current;
    if (r) {
      const u = Math.min(1, (now - this.startedAt) / LENGTH[r]);
      const e = smooth(u / 0.15) * smooth((1 - u) / 0.25);
      switch (r) {
        case "perk":
        case "waveAtCursor":
        case "wave":
          c.waveR = e;
          c.headTilt = 0.12 * e;
          c.droneLooksUp = this.over === "doll" ? 0.8 * e : 0;
          break;
        case "cheer":
          // She holds on with one hand, the other thrown up; then both.
          c.waveR = e * 0.6;
          c.armsUp = 0.5 * e * smooth((u - 0.2) / 0.3);
          c.dollNod = -0.08 * e;
          c.knees = 0.2 * e;
          c.legAmp = 0.6 * e;
          c.legRate = 2;
          c.flutter = 0.6 * e;
          break;
        case "giggle":
          c.hug = e;
          c.dollTwist = 0.3 * Math.sin(u * TAU * 5) * e;
          c.headTilt = 0.18 * Math.sin(u * TAU * 4) * e;
          c.dollNod = 0.25 * e;
          c.legAmp = 0.8 * e;
          c.legRate = 2.5;
          c.mark = u > 0.12 && u < 0.2 ? "heart" : null;
          break;
        case "big":
          c.armsUp = e;
          c.dollNod = -0.12 * e;
          c.knees = 0.35 * e;
          c.legAmp = 0.8 * e;
          c.legRate = 2.2;
          c.flutter = 0.9 * e;
          c.mark = u > 0.3 && u < 0.38 ? "sparkle" : null;
          break;
        case "dizzy": {
          const k = 1 - 0.3 * u;
          c.dollRoll = 0.3 * Math.sin(u * TAU * 2.5) * k * e;
          c.headTilt = 0.3 * Math.sin(u * TAU * 2.5 + 1) * k;
          c.dollTwist = 0.3 * Math.sin(u * TAU * 1.8) * k * e;
          c.roll = 0.1 * Math.sin(u * TAU * 2.5 + 0.4) * k * e;
          c.legAmp = 0.5 * e;
          c.legRate = 1.4;
          c.mark = u > 0.35 && u < 0.43 ? "sweat" : null;
          break;
        }
        case "laugh":
          c.dollNod = 0.18 * Math.sin(u * TAU * 4) * e;
          c.headNod = 0.1 * Math.sin(u * TAU * 4) * e;
          c.waveR = 0.5 * e;
          c.legAmp = 0.7 * e;
          c.legRate = 2.2;
          break;
        case "hug":
          c.hug = e;
          c.dollNod = 0.3 * e;
          break;
        case "startle":
          c.armsUp = 0.8 * e;
          c.slide = 0.3 * e;
          break;
        case "hop":
        case "wiggle":
        case "spin":
          c.armsUp = 0.3 * bump(u);
          c.legAmp = 0.5 * bump(u);
          break;
      }
    }
    // The lean toward the cursor is written by the pair (it knows the cursor), scaled by `leaning`.
  }
}
