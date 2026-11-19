/**
 * The arithmetic of the music section. Pure: no DOM, no three. `local` is the zones' value
 * (`stations.ts`): the scroll carries it between two stations, up and down, and it rests between.
 *
 * The story, in `local`:
 *
 *   0 to LEAVE_TO       the two drones, in the bottom corners (J10), zip off the screen
 *   LEAVE_TO to STAND   zone one: the right hand drone drags the gramophone in from the right, the
 *                       left hand one the crate of records from the left. `arrivalOf` is how much of
 *                       the scene is in (0 to 1).
 *   STAND               the rest: the scene stands, the visitor picks a record, a drone puts it on,
 *                       the other cranks, notes come out of the horn
 *   STAND to 1          zone two: the music fades, the drones drag the gramophone off to the right
 *                       and the crate off to the left, and rise to the top left (J11)
 */
import { geometry } from "../funny/timeline";
import { cornerSpots, type DuoSpots, type Screen } from "../voices/choreo";

import { ramp, smooth } from "../voices/choreo";
import { STAND } from "./stations";

export const LEAVE_TO = 0.08;
/** The arrival runs over this stretch of `local`, from nothing to a scene that stands. */
const ARRIVE: readonly [number, number] = [LEAVE_TO, STAND];
export const EXIT_FROM = STAND;
/**
 * The exit is under way once it is this far along. It is the exit curve (a smooth step) at 0.25 of the
 * zone, which is where the idle snap starts to carry a stop forward (`ZONE_FORWARD_DOWN`): a stop
 * that snaps back to the stand never got this far, so the song, the disc and the crank are left
 * alone, and a stop that carries on has already reset them. A wheel notch that wanders off the stand
 * and back is meant to leave the song playing. From here the song fades and the disc goes home.
 */
export const EXIT_RESET = 0.156;
const EXIT_TO = 1;
/** The pair rises to the top left over the last stretch of the exit (the props are gone by then). */
const RISE_FROM = 0.69;

const easeOut = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u);

/** How much of the scene is in, 0 to 1, for a `local` (a straight line: the props ease themselves). */
export function arrivalOf(local: number): number {
  return Math.min(1, Math.max(0, (local - ARRIVE[0]) / (ARRIVE[1] - ARRIVE[0])));
}

/** How far the props are from their rest, as a fraction of the way in from off screen (1 is off). */
export interface Arrival {
  /** The gramophone: 1 off the right edge, 0 at rest. */
  gramophone: number;
  /** The crate: 1 off the left edge, 0 at rest. */
  crate: number;
  /** The right drone drags the gramophone. */
  dragging: boolean;
  /** The left drone drags the crate. */
  carrying: boolean;
  /** The scene stands and the records can be picked. */
  ready: boolean;
}

export function newArrival(): Arrival {
  return { gramophone: 1, crate: 1, dragging: false, carrying: false, ready: false };
}

const G_IN: readonly [number, number] = [0.04, 0.55];
const C_IN: readonly [number, number] = [0.35, 0.95];

/** The scene at an arrival `A`, written into `out`. */
export function arrivalAt(a: number, out: Arrival): Arrival {
  out.gramophone = 1 - easeOut(ramp(a, G_IN[0], G_IN[1]));
  out.crate = 1 - easeOut(ramp(a, C_IN[0], C_IN[1]));
  out.dragging = a > 0 && a < G_IN[1] + 0.04;
  out.carrying = a > C_IN[0] - 0.02 && a < C_IN[1] + 0.04;
  out.ready = a >= 0.98;
  return out;
}

/** The weight of the pair's rise to the top left (J11) at the end of the exit, 0 to 1. */
export function riseAt(local: number): number {
  return smooth(ramp(local, RISE_FROM, EXIT_TO));
}

/** The leaving, 0 while the scene stands, 1 when the props and the drones have gone. */
export function exitAt(local: number): number {
  return smooth(ramp(local, EXIT_FROM, EXIT_TO));
}

/** The weight of the drones' leave in the first stretch: 0 at the corners, 1 gone. */
export function leaveWeight(local: number): number {
  return smooth(ramp(local, 0, LEAVE_TO));
}

export interface Place {
  x: number;
  y: number;
  /** The on-screen height. */
  height: number;
}

export interface MusicLayout {
  w: number;
  h: number;
  compact: boolean;
  /** The gramophone at rest (the screen point of its axis, and the height of its box). */
  gramophone: Place;
  /** The crate with its sleeves at rest. */
  crate: Place & { width: number };
  /** Where the drones wait: `a` above the crate, `b` by the crank. */
  aIdle: Place;
  bIdle: Place;
  /** Where `a` goes with the disc: above the crate, over the platter, at the needle. */
  aCrate: Place;
  aPlatter: Place;
}

export function newLayout(): MusicLayout {
  const place = (): Place => ({ x: 0, y: 0, height: 0 });
  return {
    w: 0,
    h: 0,
    compact: false,
    gramophone: place(),
    crate: { ...place(), width: 0 },
    aIdle: place(),
    bIdle: place(),
    aCrate: place(),
    aPlatter: place(),
  };
}

/** The rest places for a screen. A phone stacks the gramophone over the crate. */
export function layoutFor(vp: Screen, out: MusicLayout): MusicLayout {
  const { w, h } = vp;
  const compact = w < 900 || w < h * 0.9;
  out.w = w;
  out.h = h;
  out.compact = compact;
  const ball = compact ? Math.min(0.17 * w, 80) : Math.min(0.15 * h, 150);
  if (compact) {
    out.gramophone.x = -0.02 * w;
    out.gramophone.y = 0.1 * h;
    out.gramophone.height = Math.min(0.36 * h, 0.95 * w);
    out.crate.x = 0;
    out.crate.y = -0.255 * h;
    out.crate.width = 0.84 * w;
    out.crate.height = 0.26 * h;
  } else {
    out.gramophone.x = 0.2 * w;
    out.gramophone.y = 0.03 * h;
    out.gramophone.height = 0.7 * h;
    out.crate.x = -0.235 * w;
    out.crate.y = -0.22 * h;
    out.crate.width = 0.34 * w;
    out.crate.height = 0.34 * h;
  }
  const g = out.gramophone;
  const c = out.crate;
  out.bIdle.x = g.x + (compact ? 0.36 : 0.38) * g.height;
  out.bIdle.y = g.y - (compact ? 0.28 : 0.3) * g.height;
  out.bIdle.height = ball;
  // On a phone the left drone stands over the left of the crate, away from the right drone.
  out.aIdle.x = compact ? c.x - 0.2 * c.width : c.x + 0.3 * c.width;
  out.aIdle.y = c.y + 0.3 * c.height + ball * 0.9;
  out.aIdle.height = ball;
  out.aCrate.x = compact ? c.x - 0.28 * c.width : c.x + 0.05 * c.width;
  out.aCrate.y = c.y + 0.36 * c.height + ball * 0.9;
  out.aCrate.height = ball;
  // The drones are drawn under the lit gramophone: this spot is left of the horn, out of its way.
  // ...and never so far left that the ball and its gloves leave the screen.
  out.aPlatter.x = Math.max(g.x - 0.62 * g.height, -(w / 2 - 0.6 * ball));
  out.aPlatter.y = g.y + 0.04 * g.height;
  out.aPlatter.height = ball;
  return out;
}

/** J10: the two drones in the bottom corners, as the voices section leaves them. */
export function j10(vp: Screen, out: DuoSpots): DuoSpots {
  return cornerSpots(vp, out);
}

/**
 * J11: the two drones hover high at the left, where the funny section's first screen wants them
 * (`geometry().watch` of that section, so the two agree by construction).
 */
export function j11(vp: Screen, out: DuoSpots): DuoSpots {
  const g = geometry(vp.w, vp.h);
  out.a.x = g.watch[0].x;
  out.a.y = g.watch[0].y;
  out.a.h = g.watch[0].height;
  out.b.x = g.watch[1].x;
  out.b.y = g.watch[1].y;
  out.b.h = g.watch[1].height;
  return out;
}
