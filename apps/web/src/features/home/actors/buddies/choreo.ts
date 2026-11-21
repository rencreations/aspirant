import type { FaceName as DollFace } from "../doll/face/presets";
import type { FaceName as DroneFace } from "../drone/faces";

import { wrapPi } from "./smooth";

/**
 * The dances of the pair, pure (round six, `actor-buddies.md` section 3). A routine is a function of
 * time: `danceCue(name, t, energy, bpm, out)` writes what the drone and the doll do at `t` seconds
 * into a `PairCue`. Nothing here moves the place the section gives; the offsets are in drone heights
 * (y UP, as the stage) and radians, and the springs of the drone and the rider's chains do the rest.
 * The routines loop (the yaw of a spin counts turns up and never wraps, so no spring unwinds), and
 * `t` may be any real number, so a scroll that goes back plays them backwards.
 */

/** Everything the pair is asked for at one moment. All 0 is "nothing special". */
export interface PairCue {
  // The drone: an offset in its heights (y up), an attitude, how hard its wings work, a size change.
  dx: number;
  dy: number;
  roll: number;
  pitch: number;
  yaw: number;
  flutter: number;
  scale: number;
  droneFace: DroneFace | null;
  /** 0 to 1: the drone looks up at her. */
  droneLooksUp: number;
  // The doll: turn on the seat, trunk, head, legs.
  dollYaw: number;
  dollRoll: number;
  dollNod: number;
  dollTwist: number;
  headTilt: number;
  headTurn: number;
  headNod: number;
  legAmp: number;
  legRate: number;
  knees: number;
  slide: number;
  dollFace: DollFace | null;
  /** 0 to 1: she looks down at the drone. */
  looksDown: number;
  // The hands, as weights of named poses (the pair turns them into targets): both up, wave, clap, pat, hug.
  armsUp: number;
  waveL: number;
  waveR: number;
  clap: number;
  pat: number;
  hug: number;
  /** The beat, in beats since the start of the routine: the pair times a wave, a clap or a pat by it. */
  beat: number;
  /** Comic marks to ask for: "heart" | "sparkle" | "sweat" | null (rare, the pair rate limits them). */
  mark: string | null;
}

export function createCue(): PairCue {
  return {
    dx: 0,
    dy: 0,
    roll: 0,
    pitch: 0,
    yaw: 0,
    flutter: 0,
    scale: 0,
    droneFace: null,
    droneLooksUp: 0,
    dollYaw: 0,
    dollRoll: 0,
    dollNod: 0,
    dollTwist: 0,
    headTilt: 0,
    headTurn: 0,
    headNod: 0,
    legAmp: 0,
    legRate: 2,
    knees: 0,
    slide: 0,
    dollFace: null,
    looksDown: 0,
    armsUp: 0,
    waveL: 0,
    waveR: 0,
    clap: 0,
    pat: 0,
    hug: 0,
    beat: 0,
    mark: null,
  };
}

const NUMBERS = [
  "dx",
  "dy",
  "roll",
  "pitch",
  "yaw",
  "flutter",
  "scale",
  "droneLooksUp",
  "dollYaw",
  "dollRoll",
  "dollNod",
  "dollTwist",
  "headTilt",
  "headTurn",
  "headNod",
  "legAmp",
  "knees",
  "slide",
  "looksDown",
  "armsUp",
  "waveL",
  "waveR",
  "clap",
  "pat",
  "hug",
] as const;

export function clearCue(c: PairCue): PairCue {
  for (const k of NUMBERS) c[k] = 0;
  c.legRate = 2;
  c.droneFace = null;
  c.dollFace = null;
  c.mark = null;
  c.beat = 0;
  return c;
}

/** `out` = the weighted sum of the cues (the faces and the mark come from the heaviest cue that has one). */
export function blendCue(out: PairCue, parts: ReadonlyArray<readonly [PairCue, number]>): PairCue {
  clearCue(out);
  let bestDrone = 0.001;
  let bestDoll = 0.001;
  let bestMark = 0.001;
  let rate = 0;
  let rateW = 0;
  for (const [c, w] of parts) {
    if (w <= 0) continue;
    for (const k of NUMBERS) out[k] += (k === "yaw" ? wrapPi(c.yaw) : c[k]) * w;
    if (c.legAmp > 0) {
      rate += c.legRate * c.legAmp * w;
      rateW += c.legAmp * w;
    }
    if (c.droneFace && w > bestDrone) {
      out.droneFace = c.droneFace;
      bestDrone = w;
    }
    if (c.dollFace && w > bestDoll) {
      out.dollFace = c.dollFace;
      bestDoll = w;
    }
    if (c.mark && w > bestMark) {
      out.mark = c.mark;
      bestMark = w;
    }
    out.beat = Math.max(out.beat, c.beat);
  }
  out.legRate = rateW > 0 ? rate / rateW : 2;
  return out;
}

export type DanceName =
  | "sway"
  | "bob"
  | "spin"
  | "eight"
  | "twirl"
  | "hop2"
  | "shimmy"
  | "wave"
  | "clap"
  | "cheer"
  | "lean"
  | "spiral"
  | "show";

export const DANCE_NAMES: readonly DanceName[] = [
  "sway",
  "bob",
  "spin",
  "eight",
  "twirl",
  "hop2",
  "shimmy",
  "wave",
  "clap",
  "cheer",
  "lean",
  "spiral",
  "show",
];

/** The length of each routine in beats (it loops). `show` is the sequence below. */
export const BEATS: Readonly<Record<Exclude<DanceName, "show">, number>> = {
  sway: 8,
  bob: 4,
  spin: 8,
  eight: 8,
  twirl: 8,
  hop2: 4,
  shimmy: 4,
  wave: 8,
  clap: 8,
  cheer: 8,
  lean: 8,
  spiral: 16,
};

/**
 * The show: every routine in turn (beats), with a cross-fade of `FADE_BEATS` into the next. Round nine:
 * the wave is at beats 40 to 48, which the descent's scroll reaches while the two Guinevere drones
 * arrive (`sections/descent/guests.ts`), so she waves at them.
 */
export const SHOW: ReadonlyArray<readonly [Exclude<DanceName, "show">, number]> = [
  ["sway", 8],
  ["bob", 8],
  ["eight", 8],
  ["spiral", 16],
  ["wave", 8],
  ["hop2", 8],
  ["clap", 8],
  ["twirl", 8],
  ["shimmy", 8],
  ["lean", 8],
  ["spin", 8],
  ["cheer", 8],
];
export const FADE_BEATS = 1.5;

const TAU = Math.PI * 2;
export { wrapPi };
const smooth = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};
const fract = (x: number): number => x - Math.floor(x);
/** 0 at both ends of a unit period, 1 in the middle. */
const hump = (p: number): number => {
  const f = fract(p);
  return Math.sin(Math.PI * f) ** 2;
};

/** Seconds a routine takes at `bpm`. */
export function danceSeconds(name: DanceName, bpm = 100): number {
  const beats = name === "show" ? showBeats() : BEATS[name];
  return (beats * 60) / bpm;
}

export function showBeats(): number {
  let n = 0;
  for (const [, b] of SHOW) n += b;
  return n;
}

const _a = createCue();
const _b = createCue();

/** The routine `name` at `t` seconds. `energy` 0 to 1 scales the amplitude and a little the tempo. */
export function danceCue(
  name: DanceName,
  t: number,
  energy: number,
  bpm: number,
  out: PairCue,
): PairCue {
  clearCue(out);
  const en = 0.55 + 0.45 * Math.min(1, Math.max(0, energy));
  const tempo = bpm * (0.92 + 0.16 * Math.min(1, Math.max(0, energy)));
  const beat = (t * tempo) / 60;
  if (name === "show") return showAt(beat, en, out);
  routine(name, beat, en, out);
  return out;
}

/** The show at `beat`: the routine that plays, and the next one fading in at the end. */
function showAt(beat: number, en: number, out: PairCue): PairCue {
  const total = showBeats();
  const b = ((beat % total) + total) % total;
  let at = 0;
  for (let i = 0; i < SHOW.length; i += 1) {
    const entry = SHOW[i];
    if (!entry) continue;
    const [name, len] = entry;
    if (b < at + len) {
      const local = b - at;
      clearCue(_a);
      routine(name, local, en, _a);
      const left = len - local;
      if (left < FADE_BEATS) {
        const next = SHOW[(i + 1) % SHOW.length];
        if (next) {
          const w = smooth(1 - left / FADE_BEATS);
          clearCue(_b);
          routine(next[0], -left, en, _b);
          mixInto(out, _a, _b, w);
          out.beat = beat;
          return out;
        }
      }
      copyInto(out, _a);
      out.beat = beat;
      return out;
    }
    at += len;
  }
  return out;
}

function copyInto(out: PairCue, c: PairCue): void {
  for (const k of NUMBERS) out[k] = c[k];
  out.legRate = c.legRate;
  out.droneFace = c.droneFace;
  out.dollFace = c.dollFace;
  out.mark = c.mark;
  out.beat = c.beat;
}

function mixInto(out: PairCue, a: PairCue, b: PairCue, w: number): void {
  for (const k of NUMBERS) out[k] = a[k] + (b[k] - a[k]) * w;
  // A yaw counts turns: it blends by the shortest way, so a spin ending does not unwind.
  out.yaw = a.yaw + wrapPi(b.yaw - a.yaw) * w;
  out.legRate = a.legRate + (b.legRate - a.legRate) * w;
  out.droneFace = w < 0.5 ? a.droneFace : b.droneFace;
  out.dollFace = w < 0.5 ? a.dollFace : b.dollFace;
  out.mark = w < 0.5 ? a.mark : b.mark;
}

/** One routine at `beat` (beats since its start, any real number), written over a cleared cue. */
function routine(name: Exclude<DanceName, "show">, beat: number, en: number, o: PairCue): void {
  o.beat = beat;
  switch (name) {
    case "sway": {
      // Side to side over four beats, the drone banking into it, the doll a beat behind, legs swinging.
      const p = (TAU * beat) / 4;
      o.dx = 0.2 * en * Math.sin(p);
      o.dy = 0.02 * en * Math.sin(2 * p);
      o.roll = -0.12 * en * Math.cos(p);
      o.dollRoll = 0.16 * en * Math.sin(p - 0.7);
      o.headTilt = 0.16 * en * Math.sin(p - 1.2);
      o.legAmp = 0.5 * en;
      o.legRate = 0.5;
      o.droneFace = "happy";
      o.dollFace = "smile";
      o.flutter = 0.25;
      break;
    }
    case "bob": {
      // A bounce on every beat, a nod with it, the knees up.
      const f = fract(beat);
      const bounce = Math.abs(Math.sin(Math.PI * f));
      o.dy = 0.07 * en * bounce;
      o.pitch = -0.05 * en * Math.sin(TAU * beat);
      o.dollNod = 0.12 * en * Math.sin(TAU * beat - 0.5);
      o.headNod = 0.1 * en * Math.sin(TAU * beat - 1);
      o.knees = 0.2 * bounce * en;
      o.legAmp = 0.35 * en;
      o.legRate = 1;
      o.flutter = 0.35;
      o.droneFace = "happy";
      o.dollFace = "laughing";
      break;
    }
    case "spin": {
      // A slow turn about its vertical axis with her on top, a whole turn over eight beats.
      o.yaw = (TAU * beat) / 8;
      o.dy = 0.04 * en * Math.sin((TAU * beat) / 8);
      o.dollRoll = 0.1 * en;
      o.legAmp = 0.4 * en;
      o.legRate = 0.8;
      o.flutter = 0.4;
      o.droneFace = "happy";
      o.dollFace = "smile";
      break;
    }
    case "eight": {
      // A figure of eight drift, the nose going along it.
      const p = (TAU * beat) / 8;
      o.dx = 0.24 * en * Math.sin(p);
      o.dy = 0.09 * en * Math.sin(2 * p);
      o.roll = -0.1 * en * Math.cos(p);
      o.dollRoll = 0.12 * en * Math.sin(p - 0.8);
      o.headTurn = 0.3 * en * Math.sin(p);
      o.legAmp = 0.3 * en;
      o.legRate = 0.6;
      o.flutter = 0.3;
      o.droneFace = "happy";
      o.dollFace = "smile";
      break;
    }
    case "twirl": {
      // A quick turn with a hop every four beats; the turns are counted, never wrapped.
      const cycle = beat / 4;
      const turns = Math.floor(cycle) + smooth(fract(cycle) / 0.5);
      o.yaw = TAU * turns;
      o.dy = fract(cycle) < 0.6 ? 0.14 * en * Math.sin((Math.PI * fract(cycle)) / 0.6) : 0;
      o.dollRoll = 0.14 * en * Math.sin(TAU * fract(cycle));
      o.legAmp = 0.6 * en;
      o.legRate = 1.4;
      o.knees = 0.3 * en;
      o.flutter = 0.6;
      o.droneFace = "happy";
      o.dollFace = "laughing";
      break;
    }
    case "hop2": {
      // A double hop every four beats, then a rest.
      const f = fract(beat / 4);
      const a = f < 0.25 ? Math.sin((Math.PI * f) / 0.25) : 0;
      const b = f >= 0.3 && f < 0.55 ? Math.sin((Math.PI * (f - 0.3)) / 0.25) : 0;
      o.dy = 0.16 * en * Math.max(a, b);
      o.scale = 0.02 * Math.max(a, b);
      o.dollNod = -0.1 * en * Math.max(a, b);
      o.knees = 0.35 * Math.max(a, b);
      o.legAmp = 0.3 * en;
      o.legRate = 1;
      o.flutter = 0.55;
      o.droneFace = "happy";
      o.dollFace = "shocked";
      break;
    }
    case "shimmy": {
      // A quick shake: the drone rocks, she shakes her shoulders the other way.
      const p = TAU * beat * 2;
      const on = 0.35 + 0.65 * hump(beat / 4);
      o.roll = 0.22 * en * Math.sin(p) * on;
      o.dx = 0.015 * en * Math.sin(p) * on;
      o.dollTwist = 0.35 * en * Math.sin(p + 1.4) * on;
      o.dollRoll = -0.12 * en * Math.sin(p) * on;
      o.headTilt = 0.15 * en * Math.sin(p + 2) * on;
      o.legAmp = 0.45 * en;
      o.legRate = 2;
      o.flutter = 0.4;
      o.droneFace = "happy";
      o.dollFace = "laughing";
      break;
    }
    case "wave": {
      // She waves at the visitor, the drone tilts toward her and looks up.
      const on = smooth(hump(beat / 8) * 1.6);
      o.waveR = on;
      o.dollRoll = -0.06 * on;
      o.headTilt = 0.12 * on * Math.sin(TAU * beat * 0.5);
      o.roll = 0.07 * en * on;
      o.dx = 0.02 * on;
      o.droneLooksUp = 0.7 * on;
      o.legAmp = 0.3 * en;
      o.legRate = 0.8;
      o.droneFace = "happy";
      o.dollFace = "smile";
      break;
    }
    case "clap": {
      // Clapping on the beat while the drone bobs along.
      const on = smooth(hump(beat / 8) * 1.8);
      o.clap = on;
      o.dy = 0.04 * en * Math.abs(Math.sin(Math.PI * beat)) * on;
      o.dollNod = 0.06 * en * Math.sin(TAU * beat) * on;
      o.legAmp = 0.35 * en;
      o.legRate = 1;
      o.flutter = 0.3;
      o.droneFace = "happy";
      o.dollFace = "laughing";
      break;
    }
    case "cheer": {
      // Arms thrown up, pumping, the drone hopping under her.
      const on = smooth(hump(beat / 8) * 1.6);
      const pump = 0.5 + 0.5 * Math.sin(TAU * beat * 0.5);
      o.armsUp = on * (0.7 + 0.3 * pump);
      o.dy = 0.1 * en * Math.abs(Math.sin(Math.PI * beat * 0.5)) * on;
      o.dollNod = -0.12 * on;
      o.headTilt = 0.1 * Math.sin(TAU * beat * 0.5) * on;
      o.knees = 0.25 * on;
      o.legAmp = 0.5 * en;
      o.legRate = 1.5;
      o.flutter = 0.6;
      o.droneFace = "sparkle";
      o.dollFace = "laughing";
      o.mark = on > 0.8 ? "sparkle" : null;
      break;
    }
    case "lean": {
      // She leans out to one side, the drone swings under her and catches her balance.
      const p = hump(beat / 8);
      const lean = smooth(p * 1.4);
      o.dollRoll = 0.55 * lean;
      o.slide = 0.3 * lean;
      o.headTilt = 0.2 * lean;
      o.roll = 0.32 * lean;
      o.dx = -0.12 * lean;
      o.legAmp = 0.5 * en * lean;
      o.legRate = 2.2;
      o.droneLooksUp = 0.8 * lean;
      o.flutter = 0.5 * lean;
      o.droneFace = lean > 0.5 ? "alert" : "happy";
      o.dollFace = lean > 0.4 ? "scared" : "smile";
      break;
    }
    case "spiral": {
      // A slow circle, flat, going round while the section brings them down.
      const p = (TAU * beat) / 16;
      o.dx = 0.28 * en * Math.sin(p);
      o.dy = 0.06 * en * Math.cos(p);
      o.yaw = 0.7 * Math.sin(p);
      o.roll = -0.14 * en * Math.cos(p);
      o.pitch = 0.08 * en * Math.sin(p);
      o.dollRoll = 0.14 * en * Math.sin(p - 0.8);
      o.headTurn = 0.35 * en * Math.sin(p);
      o.legAmp = 0.35 * en;
      o.legRate = 0.7;
      o.flutter = 0.4;
      o.droneFace = "happy";
      o.dollFace = "smile";
      break;
    }
  }
}
