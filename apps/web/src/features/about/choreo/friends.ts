import { bump, clamp, clamp01, easeInOutSine, mix, ramp } from "./ease";
import type { PathLayout } from "./path";

/**
 * The drone's friends: Mr. Bunny in the third phase, Guinevere's two drones in the fourth. Where
 * each of them should be is a pure function of the scroll, of the measured page and of where the
 * drone is headed, as the drone's own path is; the director follows it on springs, so a flick or a
 * turn of the scroll never makes a friend jump.
 *
 * - When: each friend is on the page for a stretch of scroll, read from the meeting places in the
 *   gaps above the third, fourth and fifth phases (`meet-3`, `meet-4`, `meet-5`). Mr. Bunny comes in
 *   as the third phase nears and leaves above the fourth; the two come in above the fourth, while
 *   Mr. Bunny is still there, and leave above the fifth. `presence` is 0 off the screen, 1 with the
 *   drone, and runs between the two over a stretch of scroll, so a scroll back up plays it back.
 * - Where: beside the drone. Where the drone sits in a wide empty row (the gap above a part, a
 *   meeting place) they fly beside it on the side of the screen's middle, Guinevere's two in a row;
 *   where it sits close to words or pictures they keep close behind it, at its sides and a little
 *   lower (the page's words are usually above such a place: a caption, a label).
 *   When the drone crosses the screen they go over it to its other side.
 *
 * Every length here is in widths of the drone (`size`), every place on the screen in CSS pixels.
 */

export type FriendId = "bunny" | "bold" | "soft";

export const FRIEND_IDS: readonly FriendId[] = ["bunny", "bold", "soft"];

/** The stretch of scroll a friend is on the page: in from `in0` to `in1`, out from `out0` to `out1`. */
export interface Window {
  in0: number;
  in1: number;
  out0: number;
  out1: number;
}

export type Windows = Record<FriendId, Window | null>;

/** Where each meeting starts and ends, in screens above the meeting place's middle. */
const BUNNY_IN: readonly [number, number] = [1.02, 0.6];
const BUNNY_OUT: readonly [number, number] = [0.42, 0.14];
const PAIR_IN: Record<"bold" | "soft", readonly [number, number]> = {
  bold: [1.0, 0.62],
  soft: [0.96, 0.6],
};
const PAIR_OUT: Record<"bold" | "soft", readonly [number, number]> = {
  bold: [0.5, 0.2],
  soft: [0.46, 0.16],
};

/** The meeting places of the page, as measured, by phase. */
function meet(layout: PathLayout, n: number): number | null {
  const a = layout.anchors.find((x) => x.id === `meet-${n}`);
  return a ? a.y : null;
}

/** The stretches of scroll of the three friends, for a measured page. */
export function friendWindows(layout: PathLayout): Windows {
  const { vh } = layout;
  const m3 = meet(layout, 3);
  const m4 = meet(layout, 4);
  const m5 = meet(layout, 5);
  const win = (
    at: number | null,
    inn: readonly [number, number],
    until: number | null,
    out: readonly [number, number],
  ): Window | null =>
    at === null || until === null
      ? null
      : {
          in0: at - inn[0] * vh,
          in1: at - inn[1] * vh,
          out0: until - out[0] * vh,
          out1: until - out[1] * vh,
        };
  return {
    bunny: win(m3, BUNNY_IN, m4, BUNNY_OUT),
    bold: win(m4, PAIR_IN.bold, m5, PAIR_OUT.bold),
    soft: win(m4, PAIR_IN.soft, m5, PAIR_OUT.soft),
  };
}

/**
 * How much of the way in a friend is at this scroll, 0 to 1. With `settled` (the page has come to
 * rest) an entrance or a leaving caught half way is finished to the nearer end: nobody is left
 * hanging at the edge of the screen.
 */
export function presence(w: Window | null, scroll: number, settled = false): number {
  if (!w) return 0;
  const p = ramp(w.in0, w.in1, scroll) * (1 - ramp(w.out0, w.out1, scroll));
  if (settled && p > 0 && p < 1) return p >= 0.5 ? 1 : 0;
  return p;
}

/** True once the scroll has gone past the start of a friend's leaving. */
export function leaving(w: Window | null, scroll: number): boolean {
  return w !== null && scroll > w.out0;
}

/** Where each comes in from and goes out to: -1 the left edge, 1 the right. */
const ENTRY: Record<FriendId, number> = { bunny: 1, bold: -1, soft: 1 };
const EXIT: Record<FriendId, number> = { bunny: 1, bold: -1, soft: 1 };

/** Each friend's own side of the drone where the page leaves the choice open (the screen's middle). */
const BIAS: Record<FriendId, number> = { bunny: 1, bold: -1, soft: 1 };

/** How big each is drawn, in widths of the drone (Mr. Bunny's width; the radius of a ball). */
const FRIEND_SIZE: Record<FriendId, number> = { bunny: 0.74, bold: 0.24, soft: 0.215 };

/** A friend's place beside the drone, in widths of the drone from its middle (y down). */
export interface Slot {
  x: number;
  y: number;
  /** Its size, as a part of its own size beside the drone (smaller when it keeps close). */
  scale: number;
}

interface SlotInput {
  /** Where the drone is headed on the screen, and the screen's width. */
  droneX: number;
  vw: number;
  /** The room beside the drone (`Target.room`). */
  room: number;
  /** How far in each friend is. */
  presence: Record<FriendId, number>;
}

/**
 * The side of the drone a friend takes: toward the middle of the screen, or its own side where the
 * drone is near the middle. A smooth function of the drone's place, so a crossing is a sweep.
 */
function sideOf(id: FriendId, droneX: number, vw: number): number {
  return clamp((vw * (0.5 + 0.22 * BIAS[id]) - droneX) / (0.12 * vw), -1, 1);
}

/** The places of the three beside the drone. */
export function slots(input: SlotInput): Record<FriendId, Slot> {
  const { droneX, vw, presence: p } = input;
  const room = clamp01(input.room);
  const sb = sideOf("bunny", droneX, vw);
  const s1 = sideOf("bold", droneX, vw);
  const s2 = sideOf("soft", droneX, vw);
  // A friend that is crossing over the drone is lifted over it.
  const lift = (s: number) => 1.05 * Math.pow(1 - Math.abs(s), 1.5);

  // Mr. Bunny: beside the drone, further out while the other two are there (they take the inside).
  const pair = Math.min(p.bold, p.soft);
  const bunnyWide = { x: sb * mix(1.5, 2.6, pair), y: -0.06 - lift(sb), scale: 1 };
  const bunnyClose = { x: sb * 0.66, y: 0.16 - 0.4 * lift(sb), scale: 0.86 };

  // The two: in a row on one side, or one each side where the drone is in the middle.
  const same = (1 + s1 * s2) / 2;
  const boldWide = { x: s1 * 1.38, y: -0.12 - lift(s1), scale: 1 };
  const softWide = { x: s2 * mix(1.38, 2.32, same), y: 0.08 - lift(s2), scale: 1 };
  const boldClose = { x: -0.66, y: 0.14, scale: 0.84 };
  const softClose = { x: 0.66, y: 0.2, scale: 0.84 };

  const blend = (a: Slot, b: Slot): Slot => ({
    x: mix(a.x, b.x, room),
    y: mix(a.y, b.y, room),
    scale: mix(a.scale, b.scale, room),
  });
  return {
    bunny: blend(bunnyClose, bunnyWide),
    bold: blend(boldClose, boldWide),
    soft: blend(softClose, softWide),
  };
}

export interface FriendPlace {
  x: number;
  y: number;
  /** Its size in pixels (`FRIEND_SIZE` times the drone's width, times the slot's scale). */
  size: number;
}

interface PlaceInput {
  id: FriendId;
  /** Where the drone is headed (its goal) on the screen. */
  drone: { x: number; y: number; size: number };
  /** The friend's place relative to the drone, in widths (a slot, or a routine's place). */
  rel: Slot;
  presence: number;
  /** Whether the friend is on its way out (then it leaves by its exit side). */
  out: boolean;
  vw: number;
  vh: number;
  navH: number;
}

/** The margin kept between a friend and the edges of the screen, in pixels. */
const EDGE = 8;

/**
 * Where a friend is on the screen: its place beside the drone, kept on the screen, or on its way in
 * from (or out to) its edge of the screen, swooping down as it comes.
 */
export function placeOf(input: PlaceInput): FriendPlace {
  const { drone, rel, vw, vh, navH } = input;
  const size = Math.max(4, drone.size * FRIEND_SIZE[input.id] * rel.scale);
  // A ball's size is its radius: it reaches about two radii each way with its gloves. Mr. Bunny's
  // is its width.
  const reach = input.id === "bunny" ? size * 0.62 : size * 2.1;
  const at = {
    x: clamp(drone.x + rel.x * drone.size, EDGE + reach, Math.max(EDGE + reach, vw - EDGE - reach)),
    y: clamp(
      drone.y + rel.y * drone.size,
      navH + EDGE + reach,
      Math.max(navH + EDGE + reach, vh - EDGE - reach),
    ),
  };
  const p = clamp01(input.presence);
  if (p >= 1) return { ...at, size };
  const side = input.out ? EXIT[input.id] : ENTRY[input.id];
  const away = { x: side < 0 ? -2.2 * reach : vw + 2.2 * reach, y: at.y - 0.22 * vh };
  const e = easeInOutSine(p);
  return {
    x: mix(away.x, at.x, e),
    y: mix(away.y, at.y, e) - 0.1 * vh * bump(p),
    size,
  };
}

/** How far a friend reaches from its middle, in pixels, for the tests of being on the screen. */
export function reachOf(id: FriendId, size: number): number {
  return id === "bunny" ? size * 0.62 : size * 2.1;
}

/** True when nothing of a friend at this place is on the screen. */
export function friendOffScreen(id: FriendId, p: FriendPlace, vw: number, vh: number): boolean {
  const r = reachOf(id, p.size);
  return p.x + r <= 0 || p.x - r >= vw || p.y + r <= 0 || p.y - r >= vh;
}

/**
 * Whether a friend is drawn in front of the drone or behind it. The drone and the friends are drawn
 * in two passes, so a friend may change sides only where nothing of it is over the drone: the change
 * then cannot be seen. `want` is the side a routine asks for.
 */
export function passStep(
  want: boolean,
  front: boolean,
  friend: { x: number; y: number; reach: number },
  drone: { x: number; y: number; size: number },
): boolean {
  if (want === front) return front;
  const apart = Math.hypot(friend.x - drone.x, friend.y - drone.y);
  return apart > friend.reach + drone.size * 0.86 ? want : front;
}
