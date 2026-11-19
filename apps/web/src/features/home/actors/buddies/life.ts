/**
 * The small life of the pair while they hover (the dock) or fly with no routine (carry), pure
 * (round six). A seeded scheduler draws moments from a bag that is shuffled and never repeats a
 * moment until every one has run, with a pause between them, so nothing comes round within a minute.
 * Each moment is a function of `u`, 0 to 1 through it, written into a `PairCue`.
 */
import { clearCue, type PairCue } from "./choreo";

export type MomentName =
  | "look"
  | "swing"
  | "hum"
  | "pat"
  | "lean"
  | "whisper"
  | "yawn"
  | "wave"
  | "adjust"
  | "slip"
  | "gaze"
  | "wiggle"
  | "hug";

export const MOMENTS: readonly MomentName[] = [
  "look",
  "swing",
  "hum",
  "pat",
  "lean",
  "whisper",
  "yawn",
  "wave",
  "adjust",
  "slip",
  "gaze",
  "wiggle",
  "hug",
];

/** Seconds each moment takes, [min, max]. */
export const LENGTH: Readonly<Record<MomentName, readonly [number, number]>> = {
  look: [2.6, 3.4],
  swing: [2.8, 3.8],
  hum: [3.2, 4.2],
  pat: [2.2, 2.8],
  lean: [2.6, 3.2],
  whisper: [2.8, 3.4],
  yawn: [2.8, 3.4],
  wave: [2.2, 2.8],
  adjust: [1.6, 2.0],
  slip: [2.6, 3.0],
  gaze: [2.0, 2.6],
  wiggle: [1.8, 2.2],
  hug: [2.6, 3.2],
};

/** The pause between two moments, seconds. */
export const GAP: readonly [number, number] = [0.8, 2.0];

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
}

const smooth = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
/** 0 at both ends, 1 across the middle, eased in and out over `edge` of the length. */
const env = (u: number, edge = 0.2): number => smooth(u / edge) * smooth((1 - u) / edge);
const TAU = Math.PI * 2;

export class LifeScheduler {
  private readonly rng: Rng;
  private bag: MomentName[] = [];
  private current: MomentName | null = null;
  private side = 1;
  private t = 0;
  private len = 1;
  private gap: number;
  /** What ran, in order (a probe reads it). */
  readonly history: MomentName[] = [];

  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.gap = 0.9;
  }

  /** The moment now, or "rest". */
  get name(): string {
    return this.current ?? "rest";
  }

  /** The side the moment leans to: -1 or 1 (it flips each time). */
  get leanSide(): number {
    return this.side;
  }

  private refill(): void {
    const bag = MOMENTS.slice();
    // A shuffle (Fisher and Yates); the first of the new bag is never the last that ran.
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng.next() * (i + 1));
      const a = bag[i];
      const b = bag[j];
      if (a !== undefined && b !== undefined) {
        bag[i] = b;
        bag[j] = a;
      }
    }
    const last = this.history[this.history.length - 1];
    if (bag[0] === last && bag.length > 1) {
      const swap = bag.pop();
      if (swap) bag.unshift(swap);
    }
    this.bag = bag;
  }

  /** Start the next moment. */
  private begin(): void {
    if (this.bag.length === 0) this.refill();
    const next = this.bag.shift() ?? "look";
    this.current = next;
    this.history.push(next);
    if (this.history.length > 64) this.history.shift();
    const [lo, hi] = LENGTH[next];
    this.len = this.rng.range(lo, hi);
    this.t = 0;
    this.side = -this.side;
  }

  /** Force a moment to start now (a probe, a reaction that wants a given one). */
  start(name: MomentName): void {
    this.current = name;
    this.history.push(name);
    const [lo, hi] = LENGTH[name];
    this.len = this.rng.range(lo, hi);
    this.t = 0;
    this.side = -this.side;
  }

  /**
   * Advance by `dt` and write what the pair does into `out` (cleared first). `vigour` 0 to 1 scales
   * the moments (a docked pair plays them all out; a flying one only a little of them).
   */
  step(dt: number, _time: number, out: PairCue, vigour = 1): PairCue {
    clearCue(out);
    const d = dt > 0 ? Math.min(dt, 0.25) : 0;
    if (this.current === null) {
      this.gap -= d;
      if (this.gap <= 0) this.begin();
    } else {
      this.t += d;
      if (this.t >= this.len) {
        this.current = null;
        this.gap = this.rng.range(GAP[0], GAP[1]);
      }
    }
    this.rest(out, vigour);
    if (this.current !== null)
      this.moment(this.current, Math.min(1, this.t / this.len), vigour, out);
    return out;
  }

  /** The baseline: breath, a slow swing of the legs, a calm face. */
  private rest(o: PairCue, v: number): void {
    const t = this.t + this.history.length * 1.7;
    o.legAmp = 0.22 * v;
    o.legRate = 0.45;
    o.headTilt = 0.03 * Math.sin(t * 0.9);
    o.dollFace = "smile";
  }

  private moment(name: MomentName, u: number, v: number, o: PairCue): void {
    const e = env(u);
    const s = this.side;
    const w = (this.t * TAU) / 1;
    switch (name) {
      case "look": {
        o.headTurn = 0.55 * v * Math.sin(u * TAU) * (0.4 + 0.6 * e) * s;
        o.headNod = 0.06 * v * Math.sin(u * TAU * 2);
        o.dollFace = u > 0.25 && u < 0.7 ? "neutral" : "smile";
        break;
      }
      case "swing": {
        o.legAmp = 0.95 * v * e + 0.22 * v * (1 - e);
        o.legRate = 1.15;
        o.headTilt = 0.1 * v * Math.sin(w * 0.55) * e;
        o.dollRoll = 0.05 * v * Math.sin(w * 0.55) * e;
        o.dollFace = "grin";
        break;
      }
      case "hum": {
        // Sways from side to side, the drone sways with her a moment later.
        const p = u * TAU * 1.5;
        o.dollRoll = 0.15 * v * Math.sin(p) * e;
        o.headTilt = 0.2 * v * Math.sin(p - 0.5) * e;
        o.roll = 0.07 * v * Math.sin(p - 1.1) * e;
        o.dx = 0.03 * v * Math.sin(p - 1.1) * e;
        o.droneFace = "music";
        o.dollFace = "smile";
        o.legAmp = 0.4 * v * e;
        o.legRate = 0.75;
        break;
      }
      case "pat": {
        // She pats the drone's head, three times; it leans into it and looks up.
        o.pat = e;
        o.dollNod = 0.1 * v * e;
        o.dollFace = "smile";
        o.droneFace = "happy";
        o.droneLooksUp = 0.9 * e;
        o.dy = -0.015 * v * Math.abs(Math.sin(u * TAU * 1.5)) * e;
        o.mark = u > 0.55 && u < 0.62 ? "heart" : null;
        break;
      }
      case "lean": {
        // She leans on the dome with her cheek on it. The drone holds still, pleased.
        const k = smooth(Math.min(u / 0.3, 1)) * smooth((1 - u) / 0.3);
        o.dollNod = 0.42 * v * k;
        o.headTilt = 0.18 * s * v * k;
        o.hug = 0.65 * k;
        o.dollFace = "sleepy";
        o.droneFace = "proud";
        o.legAmp = 0.15 * v;
        break;
      }
      case "whisper": {
        // She bends to its side and tells it a secret, it tilts toward her and winks.
        const k = env(u, 0.25);
        o.dollRoll = 0.34 * s * v * k;
        o.headTilt = 0.25 * s * v * k;
        o.roll = 0.12 * s * v * k;
        o.dollFace = "smug";
        o.droneFace = u > 0.55 ? "wink" : "dots";
        o.droneLooksUp = 0.6 * k;
        o.dx = 0.015 * s * k;
        break;
      }
      case "yawn": {
        // She stretches with a yawn; then it yawns too.
        const k = env(u, 0.25);
        const y = u < 0.55;
        o.armsUp = y ? 0.65 * k * 1.5 : 0;
        o.dollNod = y ? -0.18 * k : 0;
        o.dollFace = y ? "sleepy" : "smile";
        o.droneFace = u > 0.5 ? "sleepy" : null;
        o.droneLooksUp = u > 0.4 ? 0.5 : 0;
        break;
      }
      case "wave": {
        // She waves at the visitor.
        o.waveR = e;
        o.dollFace = "grin";
        o.headTilt = 0.12 * s * e;
        o.droneFace = "happy";
        o.droneLooksUp = 0.6 * e;
        break;
      }
      case "adjust": {
        // She shifts on her seat, the grip eases and takes hold again.
        const b = Math.sin(Math.PI * u) ** 2;
        o.slide = 0.22 * s * v * b;
        o.dollNod = 0.08 * v * b;
        o.dy = 0.01 * b;
        o.dollFace = "determined";
        o.legAmp = 0.5 * v * b;
        break;
      }
      case "slip": {
        // She nearly slips, the drone swings under her and steadies her, both breathe out.
        const slipU = smooth(u / 0.22) * (1 - smooth((u - 0.42) / 0.28));
        o.slide = 0.85 * s * v * slipU;
        o.dollRoll = 0.3 * s * v * slipU;
        o.legAmp = 0.8 * v * slipU;
        o.legRate = 2.4;
        o.dollFace = u < 0.45 ? "scared" : u < 0.7 ? "shocked" : "grin";
        o.droneFace = u < 0.5 ? "alert" : "happy";
        o.roll = -0.2 * s * v * slipU;
        o.dx = -0.05 * s * v * slipU;
        o.flutter = 0.8 * slipU;
        o.droneLooksUp = u > 0.2 ? 0.8 : 0;
        o.mark = u > 0.6 && u < 0.68 ? "sweat" : null;
        break;
      }
      case "gaze": {
        // The drone blinks and looks up at her; she looks down and smiles at it.
        o.droneLooksUp = e;
        o.looksDown = e;
        o.droneFace = u > 0.35 && u < 0.6 ? "heart" : "happy";
        o.dollFace = "smile";
        o.headNod = 0.12 * v * e;
        break;
      }
      case "wiggle": {
        // A happy wiggle together.
        const p = u * TAU * 3;
        o.roll = 0.2 * v * Math.sin(p) * e;
        o.dollRoll = -0.1 * v * Math.sin(p) * e;
        o.dollTwist = 0.2 * v * Math.sin(p + 1) * e;
        o.flutter = 0.5 * e;
        o.droneFace = "happy";
        o.dollFace = "laughing";
        break;
      }
      case "hug": {
        // She hugs its head, it purrs.
        const k = env(u, 0.3);
        o.hug = k;
        o.dollNod = 0.3 * v * k;
        o.dollFace = "heartEyes";
        o.droneFace = "heart";
        o.mark = u > 0.45 && u < 0.52 ? "heart" : null;
        break;
      }
    }
  }
}
