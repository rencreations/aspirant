import { clamp, lerp } from "@/lib/math";

/** Progress of `p` between `a` and `b`, 0 to 1. */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The cut-out is 1672 x 941, and her face is a little above the middle of it. */
const PICTURE_AR = 1672 / 941;
const FACE_IN_PICTURE = 0.4;
/** How much of the picture hangs below the screen (`HANG` in `figure-gl.ts`). */
const PICTURE_HANG = 0.075;

/**
 * Where the face sits on screen (fractions of the screen), which is where the frame closes onto.
 * It follows how the scene lays the picture out: tall and from the top on a wide screen, low and
 * close to the bottom on a phone. Keep in step with `layout` in `figure-gl.ts`.
 */
export function faceOf(vw: number, vh: number): { x: number; y: number } {
  const portrait = vw / vh < 0.85;
  const figH = portrait ? Math.min(vh * 0.62, (vw * 2.4) / PICTURE_AR) : vh;
  // Her bottom edge hangs below the screen by `PICTURE_HANG` of her height.
  const top = vh + figH * PICTURE_HANG - figH;
  return { x: 0.5, y: (top + FACE_IN_PICTURE * figH) / vh };
}
/** The picture grows a little while the frame closes, so the card is a close up. */
const ZOOM = 1.45;

export interface OpeningState {
  /** The window the hero is seen through: scaled from the whole screen down to the card. */
  frameSx: number;
  frameSy: number;
  frameOpacity: number;
  /** The picture inside is scaled the other way so it keeps its shape, and moves to the card. */
  innerSx: number;
  innerSy: number;
  innerTx: number;
  innerTy: number;
  /** 0 daybreak to 1 ink. */
  tone: number;
  uiOpacity: number;
  cardOpacity: number;
  marqueeOpacity: number;
  /** 0 to 1 along the way the two rows of text travel. */
  marqueeT: number;
  /** 0 to 1: how much of the closing statement is in. */
  statement: number;
  /** The signature is written from here on. */
  signed: boolean;
  /** The hero scene is on screen, so it renders. */
  glActive: boolean;
  /** The portrait video should play. */
  videoOn: boolean;
}

export interface Measure {
  vw: number;
  vh: number;
  /** The size of the card the frame closes into, in pixels. */
  cardW: number;
  cardH: number;
}

/** What a hero can set for itself: where the frame closes onto, how far it zooms, when it starts. */
export interface HeroView {
  face?: { x: number; y: number };
  zoom?: number;
  /** The progress at which the frame starts to close (the zoom starts with it). */
  from?: number;
}

/** Everything the hero and the signature do, from the scroll progress of the pinned track. */
export function openingState(p: number, m: Measure, view: HeroView = {}): OpeningState {
  const s = easeInOut(seg(p, view.from ?? 0.1, 0.34));
  const sx = lerp(1, m.cardW / m.vw, s);
  const sy = lerp(1, m.cardH / m.vh, s);
  const z = lerp(1, view.zoom ?? ZOOM, s);
  const face = view.face ?? faceOf(m.vw, m.vh);
  const swap = seg(p, 0.31, 0.4);
  const leave = seg(p, 0.7, 0.78);
  const group = swap * (1 - leave);
  return {
    frameSx: sx,
    frameSy: sy,
    frameOpacity: 1 - swap,
    innerSx: z / sx,
    innerSy: z / sy,
    innerTx: (0.5 - face.x) * m.vw * s,
    innerTy: (0.5 - face.y) * m.vh * s,
    tone: s,
    uiOpacity: 1 - seg(p, 0.08, 0.16),
    cardOpacity: group,
    marqueeOpacity: seg(p, 0.26, 0.36) * (1 - leave),
    marqueeT: seg(p, 0.26, 0.78),
    statement: seg(p, 0.76, 0.97),
    signed: p >= 0.42,
    glActive: swap < 0.999,
    videoOn: p > 0.28 && p < 0.8,
  };
}

/** The signature draws its strokes one after the other: when each starts and how long it takes. */
export function strokeTimes(lengths: readonly number[], total: number, gap = 0.08) {
  const sum = lengths.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return lengths.map((len) => {
    const duration = (len / sum) * total;
    const start = at;
    at += duration + gap;
    return { delay: start, duration };
  });
}
