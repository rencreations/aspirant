import { TAU, clamp, clamp01, makeRandom, ramp, springTo, type Sprung } from "./ease";
import type { MouthName } from "./model";

/**
 * Tetra's face. Her eyes have six morphs (a lid for each eye, the squeezed "> <" eyes, wide eyes and
 * a slide to look) and her mouth has eight drawings, one at a time. She has no brows. So an
 * expression is a handful of numbers and a mouth, worn at a strength from 0 to 1 over the plain
 * face, and eased into: nothing pops. Pure arithmetic, no three.
 *
 * Every drawing has to read at 120 px tall and at 600 px tall, so the shapes are big: the lids and
 * the mouth carry the mood, the eyes' slide adds to it.
 */
export type FaceName =
  | "neutral"
  | "happy"
  | "laugh"
  | "angry"
  | "tired"
  | "surprised"
  | "reading"
  | "annoyed"
  | "focused";

interface FaceDef {
  /** Both lids, 0 open to 1 shut. A high value is a smile of closed eyes. */
  lid: number;
  squeeze: number;
  wide: number;
  mouth: MouthName;
  /** How big the mouth is drawn, 0 to 1. */
  size: number;
  /** The eyes look this far down (negative) or up. */
  eyeY: number;
  /** A side glance, -1 to 1 (positive is her left, the right of the screen). */
  eyeX: number;
  /** The mouth breathes: how fast (turns a second) and how much of its size. */
  breathe?: { rate: number; amount: number };
  /** She does not blink while this is above 0.5 (the lids are already shut or squeezed). */
  still?: boolean;
}

export const FACES: Readonly<Record<FaceName, FaceDef>> = {
  neutral: { lid: 0, squeeze: 0, wide: 0, mouth: "smile_mouth", size: 0.55, eyeY: 0, eyeX: 0 },
  happy: { lid: 0.78, squeeze: 0, wide: 0, mouth: "grin", size: 1, eyeY: 0, eyeX: 0, still: true },
  laugh: { lid: 0, squeeze: 1, wide: 0, mouth: "grin", size: 1, eyeY: 0, eyeX: 0, still: true },
  // The squeezed "> <" eyes with a frown: a part way squeeze draws no eyes at all, so it is all or nothing.
  angry: {
    lid: 0,
    squeeze: 1,
    wide: 0,
    mouth: "frown_mouth",
    size: 1,
    eyeY: 0,
    eyeX: 0,
    still: true,
  },
  tired: {
    lid: 0.5,
    squeeze: 0,
    wide: 0,
    mouth: "mouth_o",
    size: 0.7,
    eyeY: -0.35,
    eyeX: 0,
    breathe: { rate: 0.85, amount: 0.3 },
  },
  surprised: { lid: 0, squeeze: 0, wide: 1, mouth: "mouth_o", size: 0.9, eyeY: 0, eyeX: 0 },
  reading: { lid: 0.32, squeeze: 0, wide: 0, mouth: "smile_mouth", size: 0.3, eyeY: -0.5, eyeX: 0 },
  annoyed: {
    lid: 0.42,
    squeeze: 0.05,
    wide: 0,
    mouth: "frown_mouth",
    size: 0.6,
    eyeY: 0,
    eyeX: 0.55,
  },
  focused: { lid: 0.2, squeeze: 0.12, wide: 0, mouth: "smile_mouth", size: 0.25, eyeY: 0, eyeX: 0 },
};

export const FACE_NAMES = Object.keys(FACES) as FaceName[];

/** What the scene draws: the morph weights and the mouth. */
export interface FaceOut {
  blinkL: number;
  blinkR: number;
  squeeze: number;
  wide: number;
  lookX: number;
  lookY: number;
  mouth: MouthName;
  mouthSize: number;
}

export function createFaceOut(): FaceOut {
  return {
    blinkL: 0,
    blinkR: 0,
    squeeze: 0,
    wide: 0,
    lookX: 0,
    lookY: 0,
    mouth: "smile_mouth",
    mouthSize: 0.55,
  };
}

/** How quick an expression comes on (radians a second): about a fifth of a second. */
const FACE_OMEGA = 16;
/** The mouth shrinks to nothing before it changes its drawing, and grows into the new one. */
const MOUTH_RATE = 9;

/**
 * Where the eyes go when she reads: along a line from the left to the right, back to the left a
 * line lower, and so on down the page. `t` is the time since she started (or turned the page). The
 * line is `rate` seconds long. Writes -1..1 into `out`.
 */
export function readingGaze(t: number, rate: number, out: { x: number; y: number }): void {
  const lines = 3;
  const line = Math.floor(t / rate) % lines;
  const p = (t % rate) / rate;
  // Along the line, then a quick sweep back to the start of the next one.
  const along = ramp(0, 0.78, p);
  const back = ramp(0.78, 1, p);
  out.x = -0.6 + 1.2 * along * (1 - back);
  out.y = -0.35 - 0.18 * line;
}

export class FaceState {
  private readonly lid: Sprung = { x: 0, v: 0 };
  private readonly squeeze: Sprung = { x: 0, v: 0 };
  private readonly wide: Sprung = { x: 0, v: 0 };
  private readonly eyeY: Sprung = { x: 0, v: 0 };
  private readonly eyeX: Sprung = { x: 0, v: 0 };
  private readonly breath: Sprung = { x: 0, v: 0 };
  private readonly breathRate: Sprung = { x: 0.8, v: 0 };
  private readonly stillness: Sprung = { x: 0, v: 0 };
  private mouth: MouthName = "smile_mouth";
  private wantMouth: MouthName = "smile_mouth";
  private mouthSize = 0.55;
  private wantSize = 0.55;
  private blink = -1;
  private blinkIn = 1.2;
  private blinkTwice = false;
  /** The squeezed eyes are on (1) or off (0), changed only behind a blink. */
  private squeezeBig = 0;
  /** The blink that is running was asked for by a change of eyes: it shows even for a face that does not blink. */
  private forcedBlink = false;
  private readonly random: () => number;
  private time = 0;
  private readingT = 0;
  private readonly gaze = { x: 0, y: 0 };
  private name: FaceName = "neutral";
  private strength = 1;
  private readonly scratch = { ...FACES.neutral };

  constructor(seed = 11) {
    this.random = makeRandom(seed);
  }

  /** The face she wants and how strongly it is worn over the plain one (0 to 1). */
  set(name: FaceName, blend = 1): void {
    this.name = name;
    this.strength = clamp01(blend);
  }

  /** Start the eyes at the top of the page again (a page was turned). */
  restartReading(): void {
    this.readingT = 0;
  }

  /** Put the face on the one asked for at once, with nothing moving (a jump). */
  snap(): void {
    const t = this.target();
    this.lid.x = t.lid;
    this.squeezeBig = t.squeeze >= 0.5 ? 1 : 0;
    this.squeeze.x = this.squeezeBig ? 0 : t.squeeze;
    this.wide.x = t.wide;
    this.eyeY.x = t.eyeY;
    this.eyeX.x = t.eyeX;
    this.mouth = t.mouth;
    this.wantMouth = t.mouth;
    this.mouthSize = t.size;
    this.wantSize = t.size;
    for (const s of [this.lid, this.squeeze, this.wide, this.eyeY, this.eyeX]) s.v = 0;
  }

  /** The faces blended: the plain one and the wanted one at the wanted strength. */
  private target(): FaceDef {
    const base = FACES.neutral;
    const want = FACES[this.name];
    const s = this.strength;
    const out = this.scratch;
    out.lid = base.lid + (want.lid - base.lid) * s;
    // The squeezed eyes are all or nothing (a part way squeeze draws no eyes at all): they come on at
    // half strength, and `step` hides the switch behind a blink. A small squeeze blends as it is.
    out.squeeze =
      want.squeeze >= 0.5 ? (s >= 0.5 ? 1 : 0) : base.squeeze + (want.squeeze - base.squeeze) * s;
    out.wide = base.wide + (want.wide - base.wide) * s;
    out.eyeY = base.eyeY + (want.eyeY - base.eyeY) * s;
    out.eyeX = base.eyeX + (want.eyeX - base.eyeX) * s;
    // The mouth is the wanted one from half strength on; the size follows the strength.
    out.mouth = s >= 0.5 ? want.mouth : base.mouth;
    out.size = base.size + (want.size - base.size) * s;
    out.breathe = want.breathe;
    out.still = want.still;
    return out;
  }

  /**
   * One step. `look` is the eyes' look from the head's follow (-1 to 1 each), `dt` the time since the
   * last step. Writes the morphs into `out`.
   */
  step(dt: number, look: { x: number; y: number }, out: FaceOut): void {
    this.time += dt;
    const t = this.target();
    const wantBig = t.squeeze >= 0.5 ? 1 : 0;
    const holdingShut = t.still ? (this.lid.x > 0.5 || this.squeezeBig === 1 ? 1 : 0) : 0;
    springTo(this.lid, t.lid, FACE_OMEGA, dt);
    springTo(this.squeeze, wantBig ? 0 : t.squeeze, FACE_OMEGA, dt);
    springTo(this.wide, t.wide, FACE_OMEGA, dt);
    springTo(this.eyeY, t.eyeY, FACE_OMEGA, dt);
    springTo(this.eyeX, t.eyeX, FACE_OMEGA, dt);
    springTo(this.stillness, holdingShut, 20, dt);

    // The mouth: shrink, swap the drawing, grow.
    this.wantMouth = t.mouth;
    this.wantSize = t.size;
    if (this.mouth !== this.wantMouth) {
      this.mouthSize = Math.max(0, this.mouthSize - MOUTH_RATE * dt);
      if (this.mouthSize <= 0.001) this.mouth = this.wantMouth;
    } else {
      const d = this.wantSize - this.mouthSize;
      const step = MOUTH_RATE * dt;
      this.mouthSize += Math.abs(d) <= step ? d : Math.sign(d) * step;
    }
    // Breathing: a mouth that pants swells and falls.
    springTo(this.breathRate, t.breathe?.rate ?? this.breathRate.x, 6, dt);
    springTo(this.breath, t.breathe ? t.breathe.amount : 0, 6, dt);
    const swell = this.breath.x * Math.sin(TAU * this.breathRate.x * this.time);

    // Blinks, by a schedule of her own: not while the lids are already shut, and a double now and then.
    let shut = 0;
    if (wantBig !== this.squeezeBig && (this.blink < 0 || this.blink / 0.15 > 0.35)) {
      this.blink = 0;
      this.blinkTwice = false;
      this.forcedBlink = true;
    }
    if (this.blink < 0) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blink = 0;
        this.blinkTwice = this.random() < 0.22;
        this.blinkIn = 1.6 + this.random() * this.random() * 5.5;
      }
      if (this.blink < 0 && this.blink > -1) this.blink = Math.min(0, this.blink + dt);
    } else {
      this.blink += dt;
      const p = this.blink / 0.15;
      shut = p < 0.4 ? ramp(0, 0.4, p) : 1 - ramp(0.4, 1, p);
      // The eyes change while the lids are shut.
      if (this.forcedBlink && p >= 0.3 && this.squeezeBig !== wantBig) this.squeezeBig = wantBig;
      if (p >= 1) {
        this.blink = this.blinkTwice ? -0.1 : -1;
        this.blinkTwice = false;
        this.forcedBlink = false;
      }
    }
    shut *= this.forcedBlink ? 1 : 1 - this.stillness.x;

    // The eyes: the look of the head's follow, plus what the face itself looks at.
    let gx = look.x;
    let gy = look.y;
    if (this.name === "reading" && this.strength > 0.4) {
      this.readingT += dt;
      readingGaze(this.readingT, 1.7, this.gaze);
      gx = this.gaze.x * this.strength + look.x * (1 - this.strength);
      gy = this.gaze.y * this.strength;
    } else {
      gx += this.eyeX.x;
      gy += this.eyeY.x;
    }

    out.blinkL = clamp01(Math.max(this.lid.x, shut));
    out.blinkR = out.blinkL;
    out.squeeze = this.squeezeBig === 1 ? 1 : clamp01(this.squeeze.x);
    out.wide = clamp01(this.wide.x);
    out.lookX = clamp(gx, -1, 1);
    out.lookY = clamp(gy, -1, 1);
    out.mouth = this.mouth;
    out.mouthSize = clamp01(this.mouthSize + (this.mouth === this.wantMouth ? swell : 0));
  }
}
