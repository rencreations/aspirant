/**
 * The arithmetic of the music section. Pure: no DOM, no three. `local` is 0 at the start of the
 * section and 1 at its end (a little outside it in the lead and the tail).
 *
 * The story of the scroll, in `local`:
 *
 *   0 to LEAVE_TO       the two drones, in the bottom corners (J10), zip off the screen
 *   LEAVE_TO to LOCK_AT an empty screen
 *   LOCK_AT             the page is held (once) and the scene arrives by a clock: the right hand
 *                       drone drags the gramophone in from the right, the left hand one the crate
 *                       of records from the left. With no hold (tests, a jump, a visitor who came
 *                       back from below) the scroll brings the same scene in, `ARRIVE_SCROLL`.
 *   LOCK_AT to EXIT_FROM the scene stands: the visitor picks a record, a drone puts it on, the
 *                       other cranks, notes come out of the horn
 *   EXIT_FROM to 1      the music fades, the drones drag the gramophone off to the right and the
 *                       crate off to the left, and rise to the top left (J11)
 *
 * Arrival `A` (0 to 1) is `max(clock, scroll)`: one number that says how much of the scene is in.
 */
import { geometry } from "../funny/timeline";
import { cornerSpots, type DuoSpots, type Screen } from "../voices/choreo";

import { ramp, smooth } from "../voices/choreo";

/** The section's length in screens (its registry entry reads this). */
export const SCREENS = 2.8;

export const LEAVE_TO = 0.14;
export const LOCK_AT = 0.22;
const ARRIVE_SCROLL: readonly [number, number] = [0.22, 0.5];
export const EXIT_FROM = 0.84;
const EXIT_TO = 1;

/** Seconds the arrival takes on the clock, from nothing to a scene that stands. */
export const ARRIVE_SECONDS = 5.2;
/** Seconds the scene takes to take itself apart when the visitor scrolls back above the lock. */
export const UNARRIVE_SECONDS = 1;

const easeOut = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u);

/** The arrival that the scroll alone gives, for a position. */
export function scrollArrival(local: number): number {
  return smooth(ramp(local, ARRIVE_SCROLL[0], ARRIVE_SCROLL[1]));
}

/** The clock's arrival after `dt` seconds: it fills while the scene is wanted and empties when not. */
export function stepClock(clock: number, wanted: boolean, dt: number): number {
  const rate = wanted ? 1 / ARRIVE_SECONDS : -1 / UNARRIVE_SECONDS;
  return Math.min(1, Math.max(0, clock + rate * Math.max(0, dt)));
}

/**
 * True on the frame that a scroll position crosses the lock going down. A jump (a seek, a
 * scrollbar drag) never locks, nor does arriving from below.
 */
export function crossedLock(previous: number, now: number): boolean {
  return previous < LOCK_AT && now >= LOCK_AT && now - previous < 0.25;
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

const G_IN: readonly [number, number] = [0.04, 0.5];
const C_IN: readonly [number, number] = [0.38, 0.88];

/** The scene at an arrival `A`, written into `out`. */
export function arrivalAt(a: number, out: Arrival): Arrival {
  out.gramophone = 1 - easeOut(ramp(a, G_IN[0], G_IN[1]));
  out.crate = 1 - easeOut(ramp(a, C_IN[0], C_IN[1]));
  out.dragging = a > 0 && a < G_IN[1] + 0.04;
  out.carrying = a > C_IN[0] - 0.02 && a < C_IN[1] + 0.04;
  out.ready = a >= 0.92;
  return out;
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
