import { clamp } from "./ease";

/**
 * The Obsidia doll rides the drone through the fifth phase. The drone fetches her from behind her
 * skin's window and takes her home behind her splash art, and a scroll back up plays it the other
 * way round. Pure arithmetic: the director hands it the scroll, the drone as it is drawn and the
 * pictures, and it says where the drone should go, whether its layer is under the page, and when
 * the doll may come or go.
 *
 * Two rules hold whatever the scroll does:
 * - the doll comes and goes only on a frame where the drone is wholly out of sight, behind a
 *   picture that is really painted, or off the screen;
 * - the drone's layer goes under the page, or back over it, only while the drone as drawn is clear
 *   of the picture and nothing else is drawn on the canvas.
 *
 * Whether she should ride is a function of the scroll (`dollWanted`). Whether she does is the
 * visit's: when the two differ, the drone pays a visit to the nearer picture that is on the screen
 * and painted, goes over its top edge, down behind it, stays a moment, and comes back out the way
 * it went in. When no picture can take it (a flick carried the page past them, a jump), it goes out
 * past the nearest edge of the screen and comes back.
 */

/** A picture the drone may fly behind, in the document (CSS pixels): `pickup` and `drop`. */
export interface HideBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Place {
  x: number;
  y: number;
  size: number;
}

/**
 * How far the drone reaches from its middle, in sizes, with the doll on its head and its wings at
 * rest: to each side, up (the top of her hair) and down.
 */
const REACH = { side: 0.9, up: 0.7, down: 0.46 } as const;

/**
 * Where the doll is wanted, by how high her two pictures' middles are on the screen. Going down,
 * from when her window's middle has come up to `PICK_AT` to when her art's has come up to
 * `DROP_AT`. Going up, the pictures come down from the top: from when her art's middle has come
 * down to `DROP_UP_AT` back to when her window's has come down to `PICK_UP_AT`. Between the two
 * marks of a picture the last way the page went decides, and at rest the last answer holds.
 */
const PICK_AT = 0.8;
const DROP_AT = 0.7;
const PICK_UP_AT = 0.35;
const DROP_UP_AT = 0.4;

/** The air between the drone and the picture's edge at the door, in pixels. */
const AIR = 12;
/**
 * The layer changes only with this much air between the drone and the picture: the drone moves a
 * little more in the frame the change is drawn in.
 */
const SAFE = 6;
/** How much of the picture the drone may fill behind it. */
const FILL = 0.82;
/** Where along its top edge the drone goes in, as a part of the picture's width. */
const DOOR_AT: Record<string, number> = { pickup: 0.5, drop: 0.72 };
/** Seconds the drone stays behind the picture, and when in that time the doll comes or goes. */
const HOLD = 0.75;
const SWAP_AT = 0.3;
/**
 * How long the drone may wait at the door, in seconds, for the canvas to be free and the picture
 * to have opened (a picture opens over up to two seconds as it comes on the screen).
 */
const DOOR_WAIT = 2.6;
/** How long it hovers over the picture once it is out, before it goes back to its way. */
const OUT_STAY = 0.3;
/** How long it may take to get wholly behind the picture before it gives up and comes out. */
const DIVE_WAIT = 2.6;
/** A picture counts as on the screen while its middle is this far inside, in screens. */
const ON_SCREEN = 0.15;
/** Off the screen: this many sizes past the edge. */
const OUT = 1.4;

type VisitStage = "idle" | "approach" | "dive" | "hold" | "rise" | "out" | "edge";

export interface Visit {
  stage: VisitStage;
  /** The picture visited, or null on the way out past an edge. */
  box: string | null;
  /** Seconds in this stage. */
  t: number;
  /** Seconds the door has waited for the canvas to be free. */
  waited: number;
  /** The edge it goes out past: -1 left, 1 right. */
  side: number;
  /** The doll has come or gone on this visit. */
  swapped: boolean;
  /** The layer is under the page. */
  under: boolean;
}

export function createVisit(): Visit {
  return { stage: "idle", box: null, t: 0, waited: 0, side: 1, swapped: false, under: false };
}

export interface VisitInput {
  dt: number;
  scroll: number;
  vw: number;
  vh: number;
  /** Whether the doll should ride now (`dollWanted`) and whether she does. */
  wanted: boolean;
  carrying: boolean;
  /** The drone as it is drawn now, and the size the path asks for. */
  pose: Place;
  size: number;
  hides: readonly HideBox[];
  /** Whether the picture of a hide box is really painted (it has arrived and opened). */
  painted: (id: string) => boolean;
  /** Nothing else is drawn on the canvas: its layer may change. */
  free: boolean;
}

export interface VisitOutput {
  /** Where the drone goes now instead of its path, on the screen, or null to follow the path. */
  goal: Place | null;
  /** The layer is under the page (the picture hides the drone). */
  under: boolean;
  /** The doll comes (or goes) on this frame. */
  swap: boolean;
}

/** The four marks, in scrolls: her window going down and up, her art going down and up. */
function marks(
  hides: readonly HideBox[],
  vh: number,
): { pick: number; pickUp: number; drop: number; dropUp: number } | null {
  const pick = hides.find((h) => h.id === "pickup");
  const drop = hides.find((h) => h.id === "drop");
  if (!pick || !drop) return null;
  const p = pick.y + pick.h / 2;
  const d = drop.y + drop.h / 2;
  return {
    pick: p - PICK_AT * vh,
    pickUp: p - PICK_UP_AT * vh,
    drop: d - DROP_AT * vh,
    dropUp: d - DROP_UP_AT * vh,
  };
}

/**
 * Whether the doll should ride at this scroll: between her skin's window and her art. `dir` is
 * the way the page last went (1 down, -1 up) and `was` the last answer: between the two marks of a
 * picture they decide, so the visit starts while the picture is well on the screen whichever way
 * the page goes.
 */
export function dollWanted(
  scroll: number,
  hides: readonly HideBox[],
  vh: number,
  dir = 1,
  was = false,
): boolean {
  const m = marks(hides, vh);
  if (!m) return false;
  if (scroll < m.pick || scroll >= m.dropUp) return false;
  if (scroll >= m.pickUp && scroll < m.drop) return true;
  if (dir > 0) return scroll >= m.pickUp ? false : true;
  if (dir < 0) return scroll < m.pickUp ? false : true;
  return was;
}

/** The scrolls between which the doll may ride, for probes and for loading her: from, to. */
export function dollSpan(hides: readonly HideBox[], vh: number): [number, number] | null {
  const m = marks(hides, vh);
  return m ? [m.pick, m.dropUp] : null;
}

/** The box the drone takes up as drawn, on the screen. */
function drawnBox(p: Place): Box {
  return {
    x: p.x - REACH.side * p.size,
    y: p.y - REACH.up * p.size,
    w: 2 * REACH.side * p.size,
    h: (REACH.up + REACH.down) * p.size,
  };
}

/** True when the drone as drawn is wholly inside the box (it is out of sight behind it). */
export function covered(p: Place, box: Box): boolean {
  const d = drawnBox(p);
  return d.x >= box.x && d.y >= box.y && d.x + d.w <= box.x + box.w && d.y + d.h <= box.y + box.h;
}

/** True when nothing of the drone as drawn is over the box, nor within `air` pixels of it. */
export function clearOf(p: Place, box: Box, air = 0): boolean {
  const d = drawnBox(p);
  return (
    d.x + d.w <= box.x - air ||
    d.x >= box.x + box.w + air ||
    d.y + d.h <= box.y - air ||
    d.y >= box.y + box.h + air
  );
}

/** How much of the drone as drawn is behind the box, 0 to 1 (for probes). */
export function coveredShare(p: Place, box: Box): number {
  const d = drawnBox(p);
  const w = Math.max(0, Math.min(d.x + d.w, box.x + box.w) - Math.max(d.x, box.x));
  const h = Math.max(0, Math.min(d.y + d.h, box.y + box.h) - Math.max(d.y, box.y));
  return d.w * d.h > 0 ? (w * h) / (d.w * d.h) : 0;
}

/** True when nothing of the drone as drawn is on the screen. */
export function offScreen(p: Place, vw: number, vh: number): boolean {
  const d = drawnBox(p);
  return d.x + d.w <= 0 || d.x >= vw || d.y + d.h <= 0 || d.y >= vh;
}

/** The size the drone takes to fit behind the box, never larger than it is asked to be. */
export function insideSize(box: Box, size: number): number {
  return Math.max(
    8,
    Math.min(size, (FILL * box.w) / (2 * REACH.side), (FILL * box.h) / (REACH.up + REACH.down)),
  );
}

/** The place over the box's top edge where the drone changes layers: wholly clear of it. */
export function doorOf(box: Box, id: string, size: number): Place {
  const s = insideSize(box, size);
  return { x: box.x + box.w * (DOOR_AT[id] ?? 0.5), y: box.y - REACH.down * s - AIR, size: s };
}

/** The box on the screen at this scroll. */
function onScreenBox(h: HideBox, scroll: number): Box {
  return { x: h.x, y: h.y - scroll, w: h.w, h: h.h };
}

/** True while the middle of a picture is on the screen (or nearly). */
function onScreen(box: Box, vh: number): boolean {
  const mid = box.y + box.h / 2;
  return mid > -ON_SCREEN * vh && mid < (1 + ON_SCREEN) * vh;
}

/**
 * The nearest picture whose middle is on the screen, or null. One that has opened is taken before
 * one that is still opening (the drone waits at the door of that one).
 */
function choose(input: VisitInput): HideBox | null {
  let best: HideBox | null = null;
  let least = Infinity;
  for (const h of input.hides) {
    const box = onScreenBox(h, input.scroll);
    const mid = box.y + box.h / 2;
    if (!onScreen(box, input.vh)) continue;
    const d =
      Math.hypot(box.x + box.w / 2 - input.pose.x, mid - input.pose.y) +
      (input.painted(h.id) ? 0 : input.vh);
    if (d < least) {
      least = d;
      best = h;
    }
  }
  return best;
}

function enter(v: Visit, stage: VisitStage): void {
  v.stage = stage;
  v.t = 0;
}

/** Out past the nearest side of the screen, at the height it is now. */
function edgeGoal(v: Visit, input: VisitInput): Place {
  const s = input.size;
  return {
    x: v.side < 0 ? -OUT * s : input.vw + OUT * s,
    y: clamp(input.pose.y, 0.15 * input.vh, 0.85 * input.vh),
    size: s,
  };
}

/** One step of the visit. */
export function stepVisit(v: Visit, input: VisitInput): VisitOutput {
  v.t += input.dt;
  const want = input.wanted !== input.carrying;
  const hide = v.box ? (input.hides.find((h) => h.id === v.box) ?? null) : null;
  const box = hide ? onScreenBox(hide, input.scroll) : null;
  let swap = false;

  // A picture that is gone from the page (a new layout without it): out the plain way.
  if (v.stage !== "idle" && v.stage !== "edge" && v.stage !== "out" && !box) {
    if (v.under) {
      // Behind nothing: the layer can only come back up where it is.
      v.under = false;
    }
    enter(v, "idle");
    v.box = null;
  }

  if (v.stage === "idle") {
    if (!want) return { goal: null, under: v.under, swap: false };
    v.swapped = false;
    v.waited = 0;
    const chosen = choose(input);
    if (chosen) {
      v.box = chosen.id;
      enter(v, "approach");
    } else {
      v.box = null;
      v.side = input.pose.x < input.vw / 2 ? -1 : 1;
      enter(v, "edge");
    }
  }

  if (v.stage === "edge") {
    if (!want && !v.swapped && !offScreen(input.pose, input.vw, input.vh)) {
      // Asked back before it was out of sight: nothing to do.
      enter(v, "idle");
      return { goal: null, under: v.under, swap: false };
    }
    if (offScreen(input.pose, input.vw, input.vh)) {
      if (want) swap = true;
      v.swapped = true;
      enter(v, "idle");
      return { goal: null, under: v.under, swap };
    }
    return { goal: edgeGoal(v, input), under: v.under, swap: false };
  }

  if (v.stage === "out") {
    // Out, over the top edge, in front again: a moment there, then back to its way.
    if (v.t >= OUT_STAY || !box || !v.box || !onScreen(box, input.vh)) {
      enter(v, "idle");
      v.box = null;
      return { goal: null, under: false, swap: false };
    }
    return { goal: doorOf(box, v.box, input.size), under: false, swap: false };
  }

  if (!box || !v.box) return { goal: null, under: v.under, swap: false };

  // Behind the picture and carried off the screen with it (the page was flicked on): nothing of
  // the drone can be seen, so the doll may come or go and the layer may come back up, there.
  if (v.under && offScreen(input.pose, input.vw, input.vh)) {
    if (!v.swapped && want) swap = true;
    v.swapped = true;
    v.under = false;
    enter(v, "idle");
    v.box = null;
    return { goal: null, under: false, swap };
  }

  const door = doorOf(box, v.box, input.size);
  const inside: Place = { x: box.x + box.w / 2, y: box.y + box.h / 2, size: door.size };

  if (v.stage === "approach") {
    if (!want) {
      enter(v, "idle");
      v.box = null;
      return { goal: null, under: v.under, swap: false };
    }
    const atDoor =
      clearOf(input.pose, box, SAFE) &&
      Math.hypot(input.pose.x - door.x, input.pose.y - door.y) < 0.4 * door.size;
    const ready = input.free && input.painted(v.box);
    if (atDoor && !ready) v.waited += input.dt;
    if (atDoor && ready) {
      // The layer goes under here; the drone stays at the door for this frame and dives on the next.
      v.under = true;
      enter(v, "dive");
      return { goal: door, under: true, swap: false };
    } else if (v.waited > DOOR_WAIT || !onScreen(box, input.vh)) {
      // The canvas is not free, the picture has not opened, or the page has carried it off the
      // screen: out past the edge instead.
      v.box = null;
      v.side = input.pose.x < input.vw / 2 ? -1 : 1;
      enter(v, "edge");
      return { goal: edgeGoal(v, input), under: v.under, swap: false };
    } else {
      return { goal: door, under: v.under, swap: false };
    }
  }

  if (v.stage === "dive") {
    if (covered(input.pose, box)) enter(v, "hold");
    else if (v.t > DIVE_WAIT) enter(v, "rise");
    else return { goal: inside, under: v.under, swap: false };
  }

  if (v.stage === "hold") {
    if (!v.swapped && v.t >= SWAP_AT * HOLD && covered(input.pose, box)) {
      v.swapped = true;
      if (want) swap = true;
    }
    if (v.t >= HOLD) enter(v, "rise");
    else return { goal: inside, under: v.under, swap };
  }

  // rise: back out over the top edge. The layer comes up the moment the drone is clear of the
  // picture and the canvas is free; it waits at the door until both are true.
  if (clearOf(input.pose, box, SAFE) && input.free) {
    v.under = false;
    enter(v, "out");
    return { goal: door, under: false, swap };
  }
  return { goal: door, under: v.under, swap };
}
