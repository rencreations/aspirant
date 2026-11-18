/**
 * The chase section as arithmetic: where the doll, Silverbolt and Tetra are and when, and how the
 * camera closes in on Tetra reading, as pure functions of `local` and the size of the screen. No
 * three, no DOM. Stage pixels (the origin in the middle of the screen, y UP), `local` 0 to 1 over the
 * section's own 4 screens.
 *
 * The story, in `local`:
 *   0 .. DOLL_FROM      the stage is empty and light (the funny section's end)
 *   DOLL                the doll runs for her life, left to right, scared
 *   DRAGON              Silverbolt chases her, the jaw snapping
 *   TETRA               Tetra, angry, chases them both and runs out of breath in the middle
 *   PANT, WAVE, SIT     she pants, waves to us, sits down
 *   READ                she takes out a comic and reads it; the camera comes in
 *   WORDS               COMIC, the two comics and the button arrive, hold, and leave gracefully
 *   1                   she sits reading, the camera close, nothing else on the screen (see the notes)
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (u: number): number => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};
export const ramp = (v: number, a: number, b: number): number => smooth((v - a) / (b - a));
const line = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));

/** The length of the section in screens (design table, section 4). */
const SCREENS = 4;

/** The times of the story, as `local`. */
export const T = {
  dollFrom: 0.02,
  dollTo: 0.24,
  dragonFrom: 0.07,
  tetraFrom: 0.15,
  /** She reaches the middle and stops. */
  tetraTo: 0.46,
  panted: 0.53,
  waved: 0.6,
  sat: 0.65,
  /** The book is out and she reads. */
  readFrom: 0.64,
  zoomFrom: 0.6,
  zoomTo: 0.78,
  wordsFrom: 0.7,
  wordsTo: 0.78,
  wordsOutFrom: 0.9,
  wordsOutTo: 0.99,
} as const;

/** The poses of Tetra, in the order the story goes through them. */
export type TetraBeat = "run" | "pant" | "wave" | "sit" | "read";

export interface ChaseGeometry {
  w: number;
  h: number;
  compact: boolean;
  /** The line the runners' feet are on. */
  floor: number;
  dollH: number;
  dragonH: number;
  tetraH: number;
  /** Tetra's standing height and feet when she is zoomed on (reading). */
  zoomH: number;
  zoomFeet: number;
}

/** The dragon is about this many body blocks long, nose to tail tip, side on. */
export const DRAGON_LENGTH = 3.5;
/** How far the head is in front of the body block's middle, in body blocks. */
export const HEAD_LEAD = 0.62;

export function geometry(w: number, h: number): ChaseGeometry {
  const compact = w < 760 || w < h * 0.8;
  return {
    w,
    h,
    compact,
    floor: -0.26 * h,
    dollH: (compact ? 0.17 : 0.27) * h,
    dragonH: (compact ? 0.17 : 0.34) * h,
    tetraH: (compact ? 0.26 : 0.38) * h,
    zoomH: (compact ? 0.6 : 0.85) * h,
    zoomFeet: (compact ? -0.3 : -0.376) * h,
  };
}

/** How far along its run something is, 0 at its entrance and 1 gone (the cast leaves the screen at 1). */
function runProgress(local: number, from: number, to: number): number {
  return line(local, from, to);
}

/** The doll's feet: she runs across the floor, left to right, a little ahead of the dragon. */
export function dollPlace(
  local: number,
  g: ChaseGeometry,
  out: { x: number; y: number; dist: number; on: boolean },
): typeof out {
  const p = runProgress(local, T.dollFrom, T.dollTo);
  const x0 = -g.w / 2 - 0.5 * g.dollH - 30;
  const x1 = g.w / 2 + 0.5 * g.dollH + 30;
  out.x = lerp(x0, x1, p);
  // She bounces with every stride a little (the stride is a pure function of the distance).
  out.y = g.floor + Math.abs(Math.sin(((out.x - x0) / (0.42 * g.dollH)) * Math.PI)) * 0.025 * g.h;
  out.dist = out.x - x0;
  out.on = p > 0 && p < 1;
  return out;
}

/** How far behind the doll the dragon's head is when it comes in, and at the moment she leaves the screen. */
const GAP_END = 0.2;

function dollEnds(g: ChaseGeometry): { x0: number; x1: number; speed: number } {
  const x0 = -g.w / 2 - 0.5 * g.dollH - 30;
  const x1 = g.w / 2 + 0.5 * g.dollH + 30;
  return { x0, x1, speed: (x1 - x0) / (T.dollTo - T.dollFrom) };
}

/**
 * Where the dragon's head is, heading right. It comes in at the left edge after the doll and stays
 * behind her, closing the gap, until she is gone; then it goes on at her speed until its tail has
 * cleared the screen. One line, so it is a pure function of `local`.
 */
export function dragonHeadX(local: number, g: ChaseGeometry): number {
  const d = dollEnds(g);
  const dollAt = (l: number) => d.x0 + d.speed * (l - T.dollFrom);
  const enterX = -g.w / 2 - 20;
  const gap0 = dollAt(T.dragonFrom) - enterX;
  const gap1 = GAP_END * g.w;
  if (local <= T.dollTo) {
    const k = line(local, T.dragonFrom, T.dollTo);
    return dollAt(local) - lerp(gap0, gap1, k);
  }
  return dollAt(T.dollTo) - gap1 + d.speed * (local - T.dollTo);
}

/** The `local` span in which some of the dragon is on the screen. */
export function dragonSpan(g: ChaseGeometry): { from: number; to: number } {
  const d = dollEnds(g);
  const headEnd = d.x1 - GAP_END * g.w;
  const clear = g.w / 2 + DRAGON_LENGTH * g.dragonH + 30;
  return { from: T.dragonFrom, to: T.dollTo + (clear - headEnd) / d.speed };
}

/** Silverbolt's body block: it comes in after the doll, its head near her back, the jaw snapping. */
export function dragonPlace(
  local: number,
  g: ChaseGeometry,
  out: { x: number; y: number; pitch: number; roll: number; on: boolean },
): typeof out {
  const span = dragonSpan(g);
  const head = dragonHeadX(local, g);
  out.x = head - HEAD_LEAD * g.dragonH;
  const t = local * SCREENS;
  out.y = g.floor + 0.3 * g.dragonH + Math.sin(t * 6.3) * 0.03 * g.h;
  out.pitch = -0.22 + Math.cos(t * 6.3) * 0.08;
  out.roll = Math.sin(t * 3.7) * 0.06;
  out.on = local > span.from && local < span.to;
  return out;
}

/** Tetra's feet while she runs: she starts behind both and stops in the middle, out of breath. */
export function tetraRun(
  local: number,
  g: ChaseGeometry,
  out: { x: number; y: number; speed: number; running: boolean },
): typeof out {
  const p = line(local, T.tetraFrom, T.tetraTo);
  const x0 = -g.w / 2 - 0.5 * g.tetraH - 40;
  // She runs hard, then slows to a stop (the last third of the run is the slowing down).
  out.x = lerp(x0, 0, 1 - Math.pow(1 - p, 1.8));
  out.y = g.floor;
  out.speed = local < T.tetraFrom ? 0 : p < 1 ? 1 - 0.7 * Math.pow(p, 3) : 0;
  out.running = local > T.tetraFrom && local < T.tetraTo - 0.01;
  return out;
}

/** The beat of Tetra's story at `local`. */
export function beatAt(local: number): TetraBeat {
  if (local < T.panted - 0.035) return local < T.tetraTo - 0.02 ? "run" : "pant";
  if (local < T.waved) return "wave";
  if (local < T.readFrom) return "sit";
  return "read";
}

/** The camera coming in on Tetra: 0 standing in the road, 1 close, a little low, reading. */
export function zoomAt(local: number): number {
  return ramp(local, T.zoomFrom, T.zoomTo);
}

/** Her standing height and the place of her feet at `local`, once she has stopped (zoom included). */
export function tetraStand(
  local: number,
  g: ChaseGeometry,
  out: { x: number; y: number; height: number },
): typeof out {
  const z = zoomAt(local);
  out.x = 0;
  out.y = lerp(g.floor, g.zoomFeet, z);
  out.height = lerp(g.tetraH, g.zoomH, z);
  return out;
}

/** How much of the words (COMIC, the two comics, the button) is shown: in, a hold, out. */
export function wordsAmount(local: number): number {
  return ramp(local, T.wordsFrom, T.wordsTo) * (1 - ramp(local, T.wordsOutFrom, T.wordsOutTo));
}
