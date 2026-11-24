/**
 * The funny section as arithmetic: where everyone stands and when, as pure functions of `local` and
 * the size of the screen. No three, no DOM. The runtime reads these and sets the actors; a test holds
 * the joints. Stage pixels (the origin in the middle of the screen, y UP). `local` is sampled from
 * the visitor's scroll position by `stations.ts`.
 *
 * The story, in `local`:
 *   0 .. ENTER_END      Tetra is already dancing, in place, as Music scrolls away. The duo watch.
 *   DRAGON_IN .. OUT    play two: Silverbolt crosses right to left with the doll in its mouth. Tetra is
 *                       shocked as its nose comes in, stays shocked while it passes over her, and runs
 *                       off to the left behind its tail once the tail has cleared her. The second rest,
 *                       the drones confused.
 *   CENTRE_FROM .. TO   play three: the duo come to the middle, big, and question each other
 *   TEXT_FROM .. TO     the words arrive. The last rest is the end of the section.
 *   past the end        the page rides up in the tail (scroll linked): the duo and the words leave
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (u: number): number => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};
/** 0 before `a`, 1 after `b`, a smooth step between. */
export const ramp = (v: number, a: number, b: number): number => smooth((v - a) / (b - a));
/** 0 before `a`, 1 after `b`, a straight line between. */
const line = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));

/** The page has ridden up this far (screens) past the section's end: the duo and the words are gone. */
export const GONE = 0.74;

/** The times of the story, as `local`. */
export const T = {
  enterEnd: 0.12,
  dragonIn: 0.14,
  dragonOut: 0.48,
  /** The duo start to watch (stare) before the dragon is in. */
  watchFrom: 0.06,
  /** The stare turns into confusion. */
  confusedFrom: 0.34,
  confusedTo: 0.44,
  /** Tetra sees the dragon's nose come in (the shock starts) and is fully shocked. */
  shockFrom: 0.138,
  shockFull: 0.168,
  /** Her turn from the shock into the run takes this much of `local`. */
  turnLen: 0.03,
  centreFrom: 0.5,
  centreTo: 0.72,
  /** The duo stop being confused and start to question each other. */
  questionFrom: 0.72,
  textFrom: 0.74,
  textTo: 0.88,
} as const;

/** One place of a character: the middle of a ball or the feet of a standing one, and a height. */
export interface Spot {
  x: number;
  y: number;
  height: number;
}

export interface FunnyGeometry {
  w: number;
  h: number;
  /** A narrow screen: the cast is smaller and nearer the middle. */
  compact: boolean;
  /** Tetra's feet and her standing height while she dances. */
  tetra: Spot;
  /** The dragon's flight: the body block's height, the height of its line, where its body block starts and ends. */
  dragon: { y: number; height: number; mid0: number; mid1: number; headLead: number };
  /** The two drones while they watch. */
  watch: readonly [Spot, Spot];
  /** The two drones in the middle, big. */
  centre: readonly [Spot, Spot];
}

/** The dragon is about this many body blocks long from nose to tail tip, side on. */
const DRAGON_LENGTH = 3.5;
/** How far the head is in front of the body block's middle, in body blocks. */
const HEAD_LEAD = 0.62;
/** From the dragon's visual middle to its body block's middle, in body blocks. */
const MIDDLE = DRAGON_LENGTH / 2 - HEAD_LEAD;

export function geometry(w: number, h: number): FunnyGeometry {
  const compact = w < 760 || w < h * 0.8;
  const dh = Math.min(0.205 * h, 0.265 * w);
  const tetraH = Math.min(0.25 * h, 0.375 * w);
  const watchD = Math.min(0.08 * h, 0.105 * w);
  const centreD = compact ? Math.min(0.2 * h, 0.28 * w) : Math.min(0.27 * h, 0.19 * w);
  const tetraX = 0.19 * w;
  // Her feet are on the ground, with the space of a tenth of the screen under them (the owner, 24 Nov).
  const floor = -0.345 * h;
  return {
    w,
    h,
    compact,
    tetra: { x: tetraX, y: floor, height: tetraH },
    dragon: {
      y: 0.012 * h,
      height: dh,
      // The middle of the whole dragon, nose to tail tip: all of it is beyond the right edge at the
      // start of the crossing and beyond the left edge at the end, whichever way it heads.
      mid0: w / 2 + 30 + (DRAGON_LENGTH / 2) * dh,
      mid1: -w / 2 - 30 - (DRAGON_LENGTH / 2) * dh,
      headLead: HEAD_LEAD * dh,
    },
    watch: compact
      ? [
          { x: -0.3 * w, y: 0.3 * h, height: watchD },
          { x: -0.06 * w, y: 0.36 * h, height: watchD },
        ]
      : [
          { x: -0.3 * w, y: 0.28 * h, height: watchD },
          { x: -0.17 * w, y: 0.34 * h, height: watchD },
        ],
    centre: compact
      ? [
          { x: -0.2 * w, y: 0.2 * h, height: centreD },
          { x: 0.2 * w, y: 0.2 * h, height: centreD },
        ]
      : [
          // Low enough that the ears of the higher drone clear the top bar (they bob a little).
          { x: -0.15 * w, y: 0.075 * h, height: centreD },
          { x: 0.15 * w, y: 0.075 * h, height: centreD },
        ],
  };
}

/** The middle of the whole dragon at `local`: one straight crossing, right to left. */
function dragonMid(local: number, g: FunnyGeometry): number {
  return lerp(g.dragon.mid0, g.dragon.mid1, line(local, T.dragonIn, T.dragonOut));
}

/**
 * The dragon's body block middle at `local`. `heading` is 1 when it flies left (the scroll goes
 * down) and -1 when it flies right (the scroll goes back): the dragon turns about the middle of its
 * length, so the head is on the side it flies to and no part of it appears or vanishes in the turn.
 */
export function dragonX(local: number, g: FunnyGeometry, heading = 1): number {
  return dragonMid(local, g) - heading * MIDDLE * g.dragon.height;
}

/** True while some of the dragon is on the screen's width. */
export function dragonOnScreen(local: number): boolean {
  return local > T.dragonIn - 0.002 && local < T.dragonOut + 0.002;
}

/**
 * How far the page has ridden up, in screens, for a scroll position that is `pastEnd` screens past
 * the section's end: the duo and the words ride it out of the screen. The real scroll, not the
 * plays' `local`, so a jump past the section has them gone.
 */
export function lift(pastEnd: number): number {
  return Math.max(0, pastEnd);
}

/** The dragon's wing clock and bob: a function of the clock (it flies as it travels). */
export function bob(seconds: number, g: FunnyGeometry): { y: number; pitch: number; roll: number } {
  const t = seconds * 0.9;
  return {
    y: g.dragon.y + Math.sin(t * 5.2) * 0.045 * g.dragon.height,
    pitch: Math.cos(t * 5.2) * 0.07,
    roll: Math.sin(t * 3.1) * 0.05,
  };
}

/** From the middle of the whole dragon to its tail tip (or its nose), in body blocks. */
const HALF = DRAGON_LENGTH / 2;

/** The middle of the crossing as if it went on in a straight line after the dragon has left. */
function midRaw(local: number, g: FunnyGeometry): number {
  const u = (local - T.dragonIn) / (T.dragonOut - T.dragonIn);
  return lerp(g.dragon.mid0, g.dragon.mid1, Math.max(0, u));
}

/**
 * Where the tip of the dragon's tail is at `local` (it flies left, the tail is on the right), as if
 * the crossing went on in a straight line after the dragon has left: Tetra follows it out.
 */
export function tailX(local: number, g: FunnyGeometry): number {
  return midRaw(local, g) + HALF * g.dragon.height;
}

/** How far behind the tail tip she runs: a half of her height at first, then close behind it. */
function gapAt(local: number, g: FunnyGeometry): number {
  return g.tetra.height * lerp(0.5, 0.17, ramp(local, T.dragonIn, T.dragonOut));
}

/** Where she runs when she follows the dragon out: close behind the tail tip. */
function trailX(local: number, g: FunnyGeometry): number {
  return tailX(local, g) + gapAt(local, g);
}

/**
 * The `local` at which the dragon's tail has cleared her, so that she can run after it: the tail
 * tip is a half of her height past her spot.
 */
export function runStart(g: FunnyGeometry): number {
  const { mid0, mid1, height } = g.dragon;
  const wanted = g.tetra.x - gapAt(T.dragonIn, g);
  const u = (wanted - HALF * height - mid0) / (mid1 - mid0);
  return T.dragonIn + u * (T.dragonOut - T.dragonIn);
}

/**
 * Where she runs when the page is scrolled back up: the dragon flies right now, so she runs close
 * behind its tail on the left, and no further right than her own place.
 */
export function tetraBehindReverse(local: number, g: FunnyGeometry): number {
  return midRaw(local, g) - HALF * g.dragon.height - gapAt(local, g);
}

/**
 * Tetra's feet. She dances where she is until the dragon's tail has cleared her, then runs to the
 * left behind it: she leaves her spot slowly and then keeps close behind the tail, so she never
 * passes it and is off the screen before the second rest.
 */
export function tetraPlace(
  local: number,
  g: FunnyGeometry,
  out: { x: number; y: number; running: boolean; speed: number; leave: number },
): typeof out {
  const start = runStart(g);
  const leave = ramp(local, start, start + 0.07);
  out.x = lerp(g.tetra.x, trailX(local, g), leave);
  out.y = g.tetra.y;
  out.running = local > start + T.turnLen * 0.5;
  out.speed = 0.55 + 0.45 * leave;
  out.leave = leave;
  return out;
}

/** The poses she wears, with the one she comes from: dance, then shock, then run. */
export function tetraBeat(
  local: number,
  g: FunnyGeometry,
): { name: "dance" | "shock" | "run"; from: "dance" | "shock"; blend: number } {
  const start = runStart(g);
  if (local >= start) {
    return { name: "run", from: "shock", blend: ramp(local, start, start + T.turnLen) };
  }
  if (local >= T.shockFrom) {
    return { name: "shock", from: "dance", blend: ramp(local, T.shockFrom, T.shockFull) };
  }
  return { name: "dance", from: "dance", blend: 1 };
}
