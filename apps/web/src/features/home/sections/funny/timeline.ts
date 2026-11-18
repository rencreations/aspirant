/**
 * The funny section as arithmetic: where everyone stands and when, as pure functions of `local` and
 * the size of the screen. No three, no DOM. The runtime reads these and sets the actors; a test holds
 * the joints. Stage pixels (the origin in the middle of the screen, y UP). `local` is the plays'
 * value (`stations.ts`): a clock between three stations, not the scroll.
 *
 * The story, in `local`:
 *   0      the duo hover high at the left (the music's end); the stage is otherwise empty
 *   0 .. ENTER_END      play one: Tetra runs in from the right with the kite behind her and stops to
 *                       fly it. The first rest.
 *   DRAGON_IN .. OUT    play two: Silverbolt crosses right to left with the doll in its mouth; its
 *                       head meets the rope at CUT and the kite comes down; Tetra, angry, runs off to
 *                       the left after the dragon. The second rest, the drones confused.
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
export const line = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));

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
  /** Tetra's run to the left, after the cut. */
  runFrom: 0.04,
  runTo: 0.13,
  centreFrom: 0.5,
  centreTo: 0.72,
  /** The duo stop being confused and start to question each other. */
  questionFrom: 0.72,
  textFrom: 0.74,
  textTo: 0.88,
  /** The kite, once it has fallen a while, shrinks away in a puff. */
  kiteAway: 0.07,
  kiteGone: 0.14,
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
  /** Tetra's feet and her standing height while she flies the kite. */
  tetra: Spot;
  /** The knot of the kite in the sky, and the sail's height. */
  kite: Spot;
  /** The dragon's flight: the body block's height, the height of its line, where its body block starts and ends. */
  dragon: { y: number; height: number; x0: number; x1: number; headLead: number };
  /** The two drones while they watch. */
  watch: readonly [Spot, Spot];
  /** The two drones in the middle, big. */
  centre: readonly [Spot, Spot];
}

/** The dragon is about this many body blocks long from nose to tail tip, side on. */
const DRAGON_LENGTH = 3.5;
/** How far the head is in front of the body block's middle, in body blocks. */
const HEAD_LEAD = 0.62;

export function geometry(w: number, h: number): FunnyGeometry {
  const compact = w < 760 || w < h * 0.8;
  const dh = compact ? 0.27 * h : 0.4 * h;
  const tetraH = compact ? 0.3 * h : 0.34 * h;
  const watchD = compact ? Math.min(0.12 * h, 0.2 * w) : Math.min(0.13 * h, 0.1 * w);
  const centreD = compact ? Math.min(0.2 * h, 0.28 * w) : Math.min(0.27 * h, 0.19 * w);
  const tetraX = compact ? 0.2 * w : 0.3 * w;
  const floor = -0.43 * h;
  return {
    w,
    h,
    compact,
    tetra: { x: tetraX, y: floor, height: tetraH },
    kite: compact
      ? { x: -0.02 * w, y: 0.27 * h, height: 0.17 * h }
      : { x: 0.14 * w, y: 0.29 * h, height: 0.2 * h },
    dragon: {
      y: compact ? 0.1 * h : 0.06 * h,
      height: dh,
      // The head enters at the right edge; the tail tip clears the left edge at the end.
      x0: w / 2 + 30 + HEAD_LEAD * dh,
      x1: -w / 2 - 30 - (DRAGON_LENGTH - HEAD_LEAD) * dh,
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

/** The dragon's body block middle at `local` (the head is `headLead` to the left of it). */
export function dragonX(local: number, g: FunnyGeometry): number {
  return lerp(g.dragon.x0, g.dragon.x1, line(local, T.dragonIn, T.dragonOut));
}

/** True while some of the dragon is on the screen's width. */
export function dragonOnScreen(local: number): boolean {
  return local > T.dragonIn - 0.002 && local < T.dragonOut + 0.002;
}

/** Where Tetra's hand holds the reel, roughly, while she flies the kite (for the cut's timing). */
function reelPoint(g: FunnyGeometry): { x: number; y: number } {
  return { x: g.tetra.x - 0.12 * g.tetra.height, y: g.tetra.y + 0.5 * g.tetra.height };
}

/** The `local` at which the dragon's head meets the rope, and where on the rope (0 her hand, 1 the kite). */
export function cutMoment(g: FunnyGeometry): { local: number; at: number } {
  const reel = reelPoint(g);
  const k = g.kite;
  const y = g.dragon.y + 0.2 * g.dragon.height;
  const at = clamp01((y - reel.y) / (k.y - reel.y));
  const ropeX = lerp(reel.x, k.x, at);
  const headX = ropeX;
  const centre = headX + g.dragon.headLead;
  const local =
    T.dragonIn +
    ((g.dragon.x0 - centre) / (g.dragon.x0 - g.dragon.x1)) * (T.dragonOut - T.dragonIn);
  return { local, at: Math.min(0.85, Math.max(0.15, at)) };
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
    y: g.dragon.y + Math.sin(t * 5.2) * 0.035 * g.h,
    pitch: Math.cos(t * 5.2) * 0.07,
    roll: Math.sin(t * 3.1) * 0.05,
  };
}

/** Tetra's feet at `local`: she runs in, stands, then runs off to the left once the rope is cut. */
export function tetraPlace(
  local: number,
  g: FunnyGeometry,
  cut: number,
  out: { x: number; y: number; running: boolean; speed: number; arrive: number; leave: number },
): typeof out {
  const arrive = ramp(local, 0, T.enterEnd);
  const startX = g.w / 2 + 0.2 * g.tetra.height + 40;
  const leave = ramp(local, cut + T.runFrom, cut + T.runTo);
  const endX = -g.w / 2 - 0.5 * g.tetra.height - 40;
  // She decelerates into her spot, and accelerates away after the cut.
  const runIn = arrive < 1 && local < T.enterEnd;
  out.x = lerp(startX, g.tetra.x, 1 - Math.pow(1 - clamp01(local / T.enterEnd), 2));
  if (local > cut + T.runFrom) out.x = lerp(g.tetra.x, endX, leave * leave * (1.2 - 0.2 * leave));
  out.y = g.tetra.y;
  out.running = runIn || (local > cut + T.runFrom && leave < 1);
  out.speed = runIn ? 0.6 * (1 - arrive * 0.6) : 0.4 + 0.6 * leave;
  out.arrive = arrive;
  out.leave = leave;
  return out;
}
