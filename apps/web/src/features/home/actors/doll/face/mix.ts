/**
 * The arithmetic of the doll's face. An expression is the 55 floats of the shader's uniform array
 * (`presets.ts`); any two blend by interpolating them. Two things are done on top, as pure
 * functions of their inputs so a scroll-scrubbed blend, a jump and a frozen frame never leave a
 * state behind:
 *
 *  - The eye glyphs (the `^`, `> <`, spiral, heart, sparkle, X, dot, line) and the open eyes are
 *    drawn half transparent when they cross-fade, which shows as a ghost. When two expressions
 *    have different eye families the glyph floats do not blend: they are the first one's below
 *    the middle and the second one's above it, and both eyes blink shut across the middle, so the
 *    swap happens behind the lid.
 *  - The live layers (an automatic blink, where the eyes look, a talking mouth, the turn of the
 *    spirals) are written on top of the blend by the actor each frame.
 */
import {
  FACE_DEFAULTS,
  FACE_DIFFS,
  FACE_FLOATS,
  FACE_NAMES,
  type FaceFloat,
  type FaceName,
} from "./presets";
import { at, clamp, hash, smoothstep } from "../motion";

/** The shader's array has one spare slot at the end (`uFaceF[56]`). */
export const FACE_ARRAY_LENGTH = FACE_FLOATS.length + 1;

const INDEX = new Map(FACE_FLOATS.map((name, i) => [name, i] as const));

export function floatIndex(name: FaceFloat): number {
  const i = INDEX.get(name);
  if (i === undefined) throw new Error(`doll face: no float "${name}"`);
  return i;
}

const I = {
  openL: floatIndex("openL"),
  openR: floatIndex("openR"),
  lookX: floatIndex("lookX"),
  lookY: floatIndex("lookY"),
  mOpen: floatIndex("mOpen"),
  mD: floatIndex("mD"),
  mO: floatIndex("mO"),
  mScream: floatIndex("mScream"),
  mDash: floatIndex("mDash"),
  mSmile: floatIndex("mSmile"),
  mFrown: floatIndex("mFrown"),
  mCat: floatIndex("mCat"),
  mWavy: floatIndex("mWavy"),
  mPout: floatIndex("mPout"),
  teeth: floatIndex("teeth"),
  time: floatIndex("time"),
  blinkL: floatIndex("blinkL"),
  blinkR: floatIndex("blinkR"),
} as const;

const GLYPHS = [
  floatIndex("gArc"),
  floatIndex("gChevron"),
  floatIndex("gSpiral"),
  floatIndex("gHeart"),
  floatIndex("gStar"),
  floatIndex("gCross"),
  floatIndex("gDot"),
  floatIndex("gLine"),
] as const;

/** The mouth shapes that blend into one another, for the talking layer. */
const MOUTH_SHAPES = [I.mDash, I.mSmile, I.mFrown, I.mCat, I.mWavy, I.mPout] as const;

/** The full 55 floats of every expression, as typed arrays (the array has a spare slot). */
export const FACES: Readonly<Record<FaceName, Float32Array>> = (() => {
  const out = {} as Record<FaceName, Float32Array>;
  for (const name of FACE_NAMES) {
    const f = new Float32Array(FACE_ARRAY_LENGTH);
    FACE_FLOATS.forEach((k, i) => {
      f[i] = FACE_DEFAULTS[k];
    });
    for (const [k, v] of Object.entries(FACE_DIFFS[name])) f[floatIndex(k as FaceFloat)] = v;
    out[name] = f;
  }
  return out;
})();

export function isFaceName(name: string): name is FaceName {
  return (FACE_NAMES as readonly string[]).includes(name);
}

/**
 * The eye family of a face: -1 for open eyes, or the index (0 to 7) of the glyph that has the most
 * weight. Two faces of the same family can blend freely; two of different families swap behind a blink.
 */
export function eyeFamily(f: ArrayLike<number>): number {
  let sum = 0;
  let best = -1;
  let bestW = 0;
  for (let g = 0; g < GLYPHS.length; g++) {
    const w = at(f, GLYPHS[g] ?? 0);
    sum += w;
    if (w > bestW) {
      bestW = w;
      best = g;
    }
  }
  const open = Math.max(0, 1 - sum);
  return bestW > open ? best : -1;
}

/** The share of the eyes that is open eyes (not a glyph): what a blink can hide. 0 to 1. */
export function openShare(f: ArrayLike<number>): number {
  let sum = 0;
  for (const g of GLYPHS) sum += at(f, g);
  return clamp(1 - sum, 0, 1);
}

/** How far across the middle of a blend (0 to 1) the eyes are held shut: the half width of the lid. */
export const SWAP_HALF = 0.14;

/** The blink that hides an eye family swap: 0 outside the middle, 1 at the middle of the blend. */
export function swapBlink(w: number): number {
  return clamp(1 - Math.abs(w - 0.5) / SWAP_HALF, 0, 1);
}

/** The blend of two expressions: `out` is `a` at w 0 and `b` at w 1, with the glyph swap hidden behind a blink. */
export function mixFaces(out: Float32Array, a: Float32Array, b: Float32Array, w: number): void {
  const t = clamp(w, 0, 1);
  if (t <= 0) {
    out.set(a);
    return;
  }
  if (t >= 1) {
    out.set(b);
    return;
  }
  const n = out.length;
  for (let i = 0; i < n; i++) out[i] = at(a, i) + (at(b, i) - at(a, i)) * t;
  if (eyeFamily(a) !== eyeFamily(b)) {
    const from = t < 0.5 ? a : b;
    for (const g of GLYPHS) out[g] = at(from, g);
    const lid = swapBlink(t);
    out[I.blinkL] = Math.max(at(out, I.blinkL), lid);
    out[I.blinkR] = Math.max(at(out, I.blinkR), lid);
  }
}

/** True when two expressions would swap an eye family when they blend (the blend needs time for the blink). */
export function swapsEyes(a: Float32Array, b: Float32Array): boolean {
  return eyeFamily(a) !== eyeFamily(b);
}

/**
 * An automatic blink as a pure function of time: 0 (open) to 1 (shut). A blink every two to five
 * seconds at a hashed moment, one in five a double blink. `seed` keeps two dolls from blinking together.
 */
export function autoBlink(t: number, seed = 0): number {
  const slot = 3.4;
  const i = Math.floor(t / slot);
  const u = t - i * slot;
  const start = 0.4 + (hash(i * 7 + seed) * 0.5 + 0.5) * 2.4;
  let v = blinkCurve(u - start);
  if (hash(i * 13 + seed + 5) > 0.6) v = Math.max(v, blinkCurve(u - start - 0.26));
  return v;
}

/** One blink: down in 0.05 s, up in 0.09 s. */
function blinkCurve(u: number): number {
  if (u < 0 || u > 0.14) return 0;
  return u < 0.05 ? smoothstep(u / 0.05) : 1 - smoothstep((u - 0.05) / 0.09);
}

/** The syllables of speech: 0 to 1, a pulse at about six a second with its own slow swell. */
export function talkWobble(t: number): number {
  const syllable = Math.max(0, Math.sin(t * 38 + Math.sin(t * 3.1) * 2.4));
  const swell = 0.7 + 0.3 * Math.sin(t * 9.3 + 1.2);
  return syllable * swell;
}

/**
 * Write the live layers on top of a blended face (`out`), in place:
 *  - `blink` 0 to 1, only on the open-eye share (a `^ ^` does not blink), on top of what is there;
 *  - `look` (-1 to 1 each) where the irises look, added to the expression's own;
 *  - `talk` 0 to 1 how much the mouth is speaking at time `t` (a scream and a curse open and close;
 *    a line mouth opens into a grin shape);
 *  - the spirals' turn follows `t`.
 */
export function applyLive(
  out: Float32Array,
  live: { blink: number; lookX: number; lookY: number; talk: number; t: number },
): void {
  const share = openShare(out);
  const blink = clamp(live.blink, 0, 1) * share;
  out[I.blinkL] = Math.max(at(out, I.blinkL), blink);
  out[I.blinkR] = Math.max(at(out, I.blinkR), blink);
  out[I.lookX] = clamp(at(out, I.lookX) + live.lookX, -1, 1);
  out[I.lookY] = clamp(at(out, I.lookY) + live.lookY, -1, 1);
  out[I.time] = (live.t * 3.2) % (Math.PI * 2);
  if (live.talk > 0) applyTalk(out, live.talk, live.t);
}

/** The mouth of someone speaking, on a face. See `applyLive`. */
export function applyTalk(out: Float32Array, amount: number, t: number): void {
  const wob = talkWobble(t);
  const open = at(out, I.mD) + at(out, I.mO) + at(out, I.mScream);
  if (open >= 0.5) {
    // Already an open mouth (a scream, a curse): it opens and closes between a third and all of its own.
    const base = at(out, I.mOpen);
    out[I.mOpen] = base * (1 - amount * (1 - (0.28 + 0.72 * wob)));
    return;
  }
  // A line mouth: it turns into an open grin that follows the syllables.
  const k = amount * wob;
  for (const s of MOUTH_SHAPES) out[s] = at(out, s) * (1 - k);
  out[I.mD] = Math.min(1, at(out, I.mD) + k);
  out[I.mOpen] = Math.max(at(out, I.mOpen), 0.15 + 0.85 * k);
  out[I.teeth] = Math.max(at(out, I.teeth), 0.5 * k);
}
