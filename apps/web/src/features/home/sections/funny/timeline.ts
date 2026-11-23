/**
 * The funny section as arithmetic: where everyone stands and when, as pure functions of `local` and
 * the size of the screen. No three, no DOM. The runtime reads these and sets the actors; a test holds
 * the joints. Stage pixels (the origin in the middle of the screen, y UP). `local` is sampled from
 * the visitor's scroll position by `stations.ts`.
 *
 * The story, in `local`:
 *   0 .. ENTER_END      Tetra is already flying her kite as Music scrolls away. The duo watch.
 *   DRAGON_IN .. OUT    play two: Silverbolt crosses right to left with the doll in its mouth; its
 *                       head pushes the rope until it breaks and the kite comes down. Tetra runs off to
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
  /** The end of the fall, once the kite has dropped out of view. */
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
  const dh = Math.min(0.205 * h, 0.265 * w);
  const tetraH = Math.min(0.25 * h, 0.375 * w);
  const watchD = Math.min(0.08 * h, 0.105 * w);
  const centreD = compact ? Math.min(0.2 * h, 0.28 * w) : Math.min(0.27 * h, 0.19 * w);
  const tetraX = 0.19 * w;
  const floor = -0.275 * h;
  return {
    w,
    h,
    compact,
    tetra: { x: tetraX, y: floor, height: tetraH },
    kite: { x: -0.055 * w, y: 0.19 * h, height: tetraH * 0.57 },
    dragon: {
      y: 0.012 * h,
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
export function dragonX(local: number, g: FunnyGeometry, hit = cutMoment(g)): number {
  const { x0, x1 } = g.dragon;
  const start = lerp(x0, x1, line(hit.contact, T.dragonIn, T.dragonOut));
  const end = start - Math.min(g.w * 0.09, g.dragon.height * 0.64);
  if (local <= hit.contact) return lerp(x0, start, line(local, T.dragonIn, hit.contact));
  if (local < hit.local) {
    const u = line(local, hit.contact, hit.local);
    return lerp(start, end, 1 - (1 - u) ** 2);
  }
  const u = line(local, hit.local, T.dragonOut);
  return lerp(end, x1, u * u * (2 - u));
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
export function cutMoment(g: FunnyGeometry): { contact: number; local: number; at: number } {
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
  return { contact: local, local: local + 0.054, at: Math.min(0.85, Math.max(0.15, at)) };
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

/** Tetra flies her kite in place until the rope breaks, then chases the dragon. */
export function tetraPlace(
  local: number,
  g: FunnyGeometry,
  cut: number,
  out: { x: number; y: number; running: boolean; speed: number; arrive: number; leave: number },
): typeof out {
  const leave = ramp(local, cut + T.runFrom, cut + T.runTo);
  const endX = -g.w / 2 - 0.5 * g.tetra.height - 40;
  out.x = lerp(g.tetra.x, endX, leave * leave * (1.2 - 0.2 * leave));
  out.y = g.tetra.y;
  out.running = local > cut + T.runFrom && leave < 1;
  out.speed = 0.4 + 0.6 * leave;
  out.arrive = 1;
  out.leave = leave;
  return out;
}
