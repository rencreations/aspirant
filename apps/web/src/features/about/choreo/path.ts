import { filmBox, holdEnd, morphEnd, uncovered, windowBox, type Box } from "../film-geometry";
import { TRACK_SCREENS } from "../layout";

import { bezier, bump, clamp, clamp01, easeInOutCubic, easeInOutSine, mix, ramp } from "./ease";

/**
 * Where the drone should be for a scroll value. This is the stateless half of the flight: a pure
 * function of the scroll and of a measured layout, so it can be tested and a jump of the scroll
 * always has an answer. The drone itself follows this point on springs (`follower.ts`), which is
 * what makes a scroll up a flight up and a stop a hover.
 *
 * The drone has stations, in order down the page. It is AT a station for a stretch of scroll (it
 * then keeps the station's place on the screen, which may ride with the page), and between two
 * stations it flies a curved route whose two ends are the stations' places at that same scroll,
 * so nothing ever jumps.
 */

/** The drawings of the drone's face (the cells of its atlas). */
export type FaceName =
  "normal" | "happy" | "squint" | "scan" | "alert" | "sleepy" | "angry" | "ecg" | "dead";

/**
 * One anchor, measured. `x` and `y` are the centre in the document as it lies before anything
 * sticks (for the hero that is also its place on the screen at the top of the page) and `w` is the
 * drone's width there. An anchor inside a sticky box carries `stick`: from the scroll `from` to
 * the scroll `to` the box is held, so the anchor stands still on the screen, and it rides with the
 * page before and after.
 */
export interface AnchorBox {
  id: string;
  x: number;
  y: number;
  w: number;
  stick?: { from: number; to: number };
  face?: FaceName;
  /** The yaw at rest, in radians. Positive faces the right of the screen. */
  turn?: number;
}

export interface PathLayout {
  vw: number;
  vh: number;
  navH: number;
  gutter: number;
  /** The reel's preview at the top of the page (what the film grows out of). */
  slot: Box;
  /** Hero, perch, center, dock, then every other anchor down the page. */
  anchors: AnchorBox[];
}

export interface Target {
  x: number;
  y: number;
  size: number;
  /** The yaw the drone eases to when it is not moving. */
  restTurn: number;
  face: FaceName;
  /** The station the drone is at, or the nearer end of the flight it is on. */
  station: string;
  /** 0 at a station, rising to 1 in the middle of a flight. */
  travelling: number;
  /**
   * True while the drone waits on the screen away from its anchor (the anchor has gone up under
   * the bar and the next one is not near yet). It is at no station then.
   */
  parked: boolean;
  /** The flight's two ends and how far along it is (0 to 1, by scroll). Equal ends at a station. */
  from: string;
  to: string;
  u: number;
}

/** The air kept between the drone and the edges of the screen, in pixels. */
export const EDGE = 10;

/** How far from its centre the drone is taken to reach, in widths, when it must clear the film. */
export const CLEAR_REACH = 0.56;

/** The least of the drone that must stay in view while it is behind the film. */
export const SEEN_MIN = 0.55;

/** Behind the film (the layer under it) or in front of it (the layer over it). */
export type Side = "behind" | "front";

/**
 * The part of the flight off the perch at which the hop is highest (the drone changes sides
 * there), at most. It is earlier when the flight is long: the hop must be over while the window
 * still stands, because a window that is leaving would rise into the drone.
 */
const HOP_AT = 0.2;
/** The part of the scroll between leaving the perch and the window's leaving at which it peaks. */
const HOP_BEFORE_LEAVING = 0.62;
/** On a screen where the drone crosses in front of the film: the part of the climb it does so. */
const CROSS_START = 0.012;
const CROSS_END = 0.86;

/** How long before the window starts to leave the drone sets off from the perch, in screens. */
const PERCH_LEAVES_BEFORE = 0.24;

/**
 * How much of the drone's width is behind the window's top edge when it sits on the perch, at
 * most. Its face is the lower half of what the visitor sees: sunk deeper than this the drone would
 * show only the top of its head, so a perch that the page places lower is raised to this.
 */
const PERCH_SUNK = 0.2;

/** A portrait screen gets the phone layout of the same parts. */
const portrait = (vw: number, vh: number) => vw < vh * 0.8;

const deg = (d: number) => (d * Math.PI) / 180;

/** The rest turns of the four stations that have their own logic. */
const TURN: Record<string, number> = {
  // To the right and a little toward the camera, as the owner asked.
  hero: deg(48),
  // On the right end of the window, looking back along it.
  perch: deg(-24),
  center: 0,
  dock: 0,
};

/**
 * The four anchors with their own logic, as the design's table places them, for a screen where
 * the page has not placed them (or not yet). The page always works from these alone.
 */
export function defaultAnchors(vw: number, vh: number, navH: number, gutter: number): AnchorBox[] {
  const tall = portrait(vw, vh);
  const win = windowBox(vw, vh, navH, gutter);
  const perchW = clamp(0.09 * vw, 84, 150);
  const stuck = { from: 0, to: holdEnd(vh) };
  const statementTop = TRACK_SCREENS * vh;
  const centerFrom = statementTop - 0.5 * vh;
  return [
    tall
      ? { id: "hero", x: 0.5 * vw, y: 0.79 * vh, w: Math.min(0.58 * vw, 0.3 * vh) }
      : { id: "hero", x: 0.14 * vw, y: 0.7 * vh, w: Math.min(0.46 * vw, 0.82 * vh) },
    {
      id: "perch",
      x: win.x + win.w * 0.82,
      y: Math.max(navH + EDGE + perchW / 2, win.y - (0.5 - PERCH_SUNK) * perchW),
      w: perchW,
      stick: stuck,
    },
    {
      id: "center",
      x: 0.5 * vw,
      y: centerFrom + 0.5 * vh,
      w: tall ? 0.56 * vw : 0.3 * vw,
      stick: { from: centerFrom, to: centerFrom + 1.1 * vh },
    },
    { id: "dock", x: 0.5 * vw, y: statementTop + 1.2 * vh, w: Math.max(84, 0.08 * vw) },
  ];
}

/** The reel's preview as the design places it, for when the film has not said where it is. */
function defaultSlot(vw: number, vh: number, gutter: number): Box {
  if (portrait(vw, vh)) {
    const w = vw - 2 * gutter;
    return { x: gutter, y: 0.44 * vh, w, h: (w * 810) / 1920 };
  }
  const w = 0.34 * vw;
  const h = (w * 810) / 1920;
  return { x: 0.495 * vw, y: vh - gutter - h, w, h };
}

/**
 * A whole layout from what was measured. Missing anchors of the first four come from the
 * defaults. Every other anchor is kept if it lies below the dock, in order down the page.
 */
export function completeLayout(
  vw: number,
  vh: number,
  navH: number,
  gutter: number,
  measured: readonly AnchorBox[] = [],
  slot: Box | null = null,
): PathLayout {
  const defaults = defaultAnchors(vw, vh, navH, gutter);
  const own = defaults.map((d) => {
    const m = measured.find((a) => a.id === d.id && a.w > 0);
    return m ? { ...m } : d;
  });
  const dock = own[3];
  const others = measured
    .filter((a) => !(a.id in TURN) && a.w > 0 && dock !== undefined && a.y > dock.y)
    .sort((a, b) => a.y - b.y);
  return {
    vw,
    vh,
    navH,
    gutter,
    slot: slot ?? defaultSlot(vw, vh, gutter),
    anchors: [...own, ...others],
  };
}

/** How far the page has carried an anchor up at this scroll. */
function carried(a: AnchorBox, scroll: number): number {
  if (!a.stick) return scroll;
  const { from, to } = a.stick;
  if (scroll <= from) return scroll;
  if (scroll <= to) return from;
  return from + (scroll - to);
}

interface Station {
  anchor: AnchorBox;
  /** The scroll at which the drone has arrived, and the scroll at which it sets off again. */
  arrive: number;
  leave: number;
  turn: number;
  face: FaceName;
}

export interface Path {
  readonly layout: PathLayout;
  readonly win: Box;
  /** The scrolls at which the drone is at each station, for tests and probes. */
  readonly stations: ReadonlyArray<{ id: string; arrive: number; leave: number }>;
  /** The stretch of scroll over which the statement turns the drone. */
  readonly spin: { from: number; to: number };
  /** True where the drone cannot get round the film and crosses in front of it (a phone). */
  readonly crossing: boolean;
  /** The side of the film the drone belongs on at this scroll (see `layering.ts`). */
  side: (scroll: number) => Side;
  /** The place above the window where the drone changes sides, while the window stands. */
  clear: () => { x: number; y: number; size: number };
  /** The film's box at this scroll, by the arithmetic the film itself uses. */
  film: (scroll: number) => Box;
  /**
   * The target for a scroll. With `settled` (the page has come to rest), a flight between two
   * plain anchors is not held half way, over whatever is there: the drone finishes the hop to the
   * nearer of the two, and takes the flight up again from there when the page moves.
   */
  at: (scroll: number, settled?: boolean) => Target;
}

/** The band of the screen a plain anchor holds the drone in: it arrives low and leaves high. */
const BAND_IN = 0.64;
const BAND_OUT = 0.36;
/**
 * Where the drone waits when its anchor has left the screen and the next is not near: in the
 * page's margin, small enough to fit there with its wings (it is drawn about one and a half times
 * its size). `LOT_OVER` is the scroll, in screens, over which it draws back there.
 */
const LOT_OF_GUTTER = 0.6;
const LOT_MIN = 30;
const LOT_MAX = 46;
const LOT_DOWN = 0.14;
const LOT_OVER = 0.22;
/** The longest flight between two plain anchors, and the shortest any flight may be, in screens. */
const FLIGHT_MAX = 0.5;
const FLIGHT_MIN = 0.12;

/** Lay the stations out along the scroll. */
function schedule(layout: PathLayout): Station[] {
  const { vh, anchors } = layout;
  const [hero, perch, center, dock, ...others] = anchors;
  if (!hero || !perch || !center || !dock) return [];
  const face = (a: AnchorBox, fallback: FaceName) => a.face ?? fallback;
  const turn = (a: AnchorBox) =>
    a.turn ?? TURN[a.id] ?? (a.x > layout.vw * 0.5 ? deg(-22) : deg(22));

  // The perch: from the end of the morph until shortly before the stage lets go.
  const perchLeave = holdEnd(vh) - PERCH_LEAVES_BEFORE * vh;
  // The dock is reached when its ring is a little under the middle of the screen.
  const dockArrive = Math.max(dock.y - 0.6 * vh, perchLeave + 3 * FLIGHT_MIN * vh);
  // The middle of the statement: not before the drone has had room to come down from the perch,
  // and it leaves in time to land.
  const centerLeave = dockArrive - 0.42 * vh;
  let centerArrive = Math.max(perchLeave + 0.5 * vh, (center.stick?.from ?? 0) + 0.04 * vh);
  if (centerArrive > centerLeave) {
    centerArrive = Math.max(perchLeave + FLIGHT_MIN * vh, centerLeave);
  }

  const list: Station[] = [
    { anchor: hero, arrive: 0, leave: 0, turn: turn(hero), face: face(hero, "normal") },
    {
      anchor: perch,
      arrive: morphEnd(vh),
      leave: perchLeave,
      turn: turn(perch),
      face: face(perch, "normal"),
    },
    {
      anchor: center,
      arrive: centerArrive,
      leave: Math.max(centerArrive, centerLeave),
      turn: turn(center),
      face: face(center, "happy"),
    },
    {
      anchor: dock,
      arrive: Math.max(dockArrive, centerArrive + FLIGHT_MIN * vh),
      leave: Infinity,
      turn: turn(dock),
      face: face(dock, "normal"),
    },
  ];
  for (const a of others) {
    list.push({
      anchor: a,
      arrive: a.y - BAND_IN * vh,
      leave: Infinity,
      turn: turn(a),
      face: face(a, "normal"),
    });
  }
  // The plain rule, from the dock on: the drone stays with its anchor until the next one is near,
  // then flies to it. Two anchors that are close share the scroll between them.
  for (let i = 3; i < list.length - 1; i += 1) {
    const here = list[i];
    const next = list[i + 1];
    if (!here || !next) continue;
    next.arrive = Math.max(next.arrive, here.arrive + 2 * FLIGHT_MIN * vh);
    const rest = here.anchor.y - BAND_OUT * vh;
    here.leave = clamp(
      Math.max(rest, next.arrive - FLIGHT_MAX * vh),
      here.arrive,
      next.arrive - FLIGHT_MIN * vh,
    );
  }
  return list;
}

interface Place {
  x: number;
  y: number;
  size: number;
}

/**
 * The path for a layout. Build it once per measurement; `at` reads only the scroll.
 */
export function buildPath(layout: PathLayout): Path {
  const { vw, vh, navH, gutter } = layout;
  const win = windowBox(vw, vh, navH, gutter);
  const stations = schedule(layout);
  const last = stations.length - 1;

  // The perch: on the window's top edge like a bird on a wire, its face clear of the edge.
  const onEdge = stations[1];
  if (onEdge) {
    const a = onEdge.anchor;
    const y = Math.max(navH + EDGE + a.w / 2, win.y - (0.5 - PERCH_SUNK) * a.w);
    if (y < a.y) onEdge.anchor = { ...a, y };
  }

  /** The band of the screen the whole drone fits in. */
  const fit = (p: Place): Place => {
    const r = p.size / 2;
    const top = navH + EDGE + r;
    const bottom = vh - EDGE - r;
    return {
      x: vw - 2 * EDGE > p.size ? clamp(p.x, EDGE + r, vw - EDGE - r) : vw / 2,
      y: bottom > top ? clamp(p.y, top, bottom) : (top + bottom) / 2,
      size: p.size,
    };
  };

  /** A station's place on the screen at this scroll. */
  const place = (i: number, scroll: number): Place => {
    const st = stations[i];
    if (!st) return { x: vw / 2, y: vh / 2, size: 100 };
    const a = st.anchor;
    // The hero keeps its place on the screen while the page starts to move under it.
    if (i === 0) return { x: a.x, y: a.y, size: a.w };
    const raw = { x: a.x, y: a.y - carried(a, scroll), size: a.w };
    // The last anchor leaves with the page. Every other one keeps the drone on the screen while
    // it waits for the next.
    if (i === last) return raw;
    const held = fit(raw);
    if (i < 3) return held;
    // From the dock on, an anchor that has gone up leaves the drone over whatever fills the
    // screen now (a picture, a list). So it does not wait under the bar: as its anchor leaves,
    // it draws back, small, into the page's margin on its own side, and waits there.
    const k = easeInOutSine(clamp01((navH + EDGE + raw.size / 2 - raw.y) / (LOT_OVER * vh)));
    if (k <= 0) return held;
    const size = clamp(LOT_OF_GUTTER * gutter, LOT_MIN, LOT_MAX);
    const inset = Math.max(gutter / 2, EDGE + size * 0.8);
    const lot = { x: a.x > vw / 2 ? vw - inset : inset, y: navH + LOT_DOWN * vh, size };
    return {
      x: mix(held.x, lot.x, k),
      y: mix(held.y, lot.y, k),
      size: mix(held.size, lot.size, k),
    };
  };

  /** The way to the perch as it would be flown behind the film, before the edges are minded. */
  const climb = (a: Place, b: Place, u: number): Place => {
    const t = Math.sin((Math.PI / 2) * u);
    const lift = Math.max(navH + EDGE + b.size * 0.5, b.y - 0.22 * vh);
    // Further away in the middle of the crossing, nearer again to land.
    const far = 1 - 0.2 * Math.pow(Math.sin(Math.PI * ramp(0.3, 1, u)), 2);
    return {
      x: bezier(a.x, a.x + 0.05 * vw, mix(a.x, b.x, 0.62), b.x, t),
      y: bezier(a.y, lift - 0.06 * vh, lift - 0.03 * vh, b.y, t),
      size: mix(a.size, b.size, 1 - Math.pow(1 - t, 2.6)) * far,
    };
  };

  // Where the film is as wide as the screen (a phone) there is no way round it: the drone would
  // be hidden behind it on the way up. There it crosses in front, and goes behind at the perch.
  const hero = stations[0];
  const perch = stations[1];
  let crossing = false;
  if (hero && perch) {
    for (let k = 1; k < 40 && !crossing; k += 1) {
      const u = k / 40;
      const scroll = perch.arrive * u;
      const p = climb(place(0, scroll), place(1, scroll), u);
      crossing = uncovered(p.x, p.y, p.size / 2, filmBox(layout.slot, win, scroll, vh)) < SEEN_MIN;
    }
  }

  // Where in the flight off the perch the hop peaks.
  const diveTo = stations[2];
  const hopAt =
    perch && diveTo
      ? Math.min(
          HOP_AT,
          (HOP_BEFORE_LEAVING * Math.max(0, holdEnd(vh) - perch.leave)) /
            Math.max(1, diveTo.arrive - perch.leave),
        )
      : HOP_AT;

  /** The route of one flight: where the drone is at the fraction `u` of the scroll between. */
  const route = (i: number, a: Place, b: Place, u: number): Place => {
    if (i === 0) {
      // Up and over. The film grows out of the right and takes the middle and the foot of the
      // screen, so the drone climbs the left side first, small early, and crosses along the top
      // to come down on the window's edge from above.
      const p = climb(a, b, u);
      if (crossing) {
        // In front of the film: it comes in over the clear place, where it changes sides.
        const clear = clearPlace(win, navH, b);
        const hop =
          ramp(2 * CROSS_END - 1.12, CROSS_END - 0.04, u) * (1 - ramp(CROSS_END + 0.04, 1, u));
        p.y += (clear.y - b.y) * hop;
        p.size *= mix(1, clear.size / b.size, hop);
      }
      // It starts cut by the edges of the screen, on purpose, and is whole soon after.
      const k = ramp(0.12, 0.4, u);
      const f = fit(p);
      return { x: mix(p.x, f.x, k), y: mix(p.y, f.y, k), size: p.size };
    }
    if (i === 1) {
      // Off the perch: a small hop up and back, clear of the window (the moment it comes round to
      // the front of the film), then a dive down and toward the visitor.
      const t = easeInOutCubic(clamp01((u - 0.7 * hopAt) / (1 - 0.7 * hopAt)));
      const hop = ramp(0, 0.75 * hopAt, u) * (1 - ramp(1.25 * hopAt, 2.2 * hopAt, u));
      const clear = clearPlace(win, navH, a);
      const size = mix(a.size, b.size, t * t) * mix(1, clear.size / a.size, hop);
      return fit({
        x: bezier(a.x, a.x + 0.02 * vw, b.x + 0.14 * vw, b.x, t),
        y: bezier(a.y, mix(a.y, b.y, 0.3), b.y + 0.05 * vh, b.y, t) + (clear.y - a.y) * hop,
        size,
      });
    }
    if (i === 2) {
      // Down into the ring, with a small sway.
      const t = easeInOutSine(u);
      return fit({
        x: mix(a.x, b.x, t) + Math.sin(2 * Math.PI * t) * 0.012 * vw,
        y: mix(a.y, b.y, t),
        size: mix(a.size, b.size, t),
      });
    }
    // Between two plain anchors: an arc to one side (the side changes every time), a little
    // nearer the visitor in the middle.
    const t = easeInOutSine(u);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const side = i % 2 === 0 ? 1 : -1;
    const amp = Math.min(0.16 * d, 0.1 * vw) * side * bump(t);
    return fit({
      x: mix(a.x, b.x, t) + (-dy / d) * amp,
      y: mix(a.y, b.y, t) + (dx / d) * amp,
      size: mix(a.size, b.size, t) * (1 + 0.1 * bump(t)),
    });
  };

  const at = (scroll: number, settled = false): Target => {
    const first = stations[0];
    if (!first) {
      return {
        x: vw / 2,
        y: vh / 2,
        size: 100,
        restTurn: 0,
        face: "normal",
        station: "hero",
        travelling: 0,
        parked: false,
        from: "hero",
        to: "hero",
        u: 0,
      };
    }
    const s = Math.max(0, scroll);
    // The station the drone has last arrived at or set off from.
    let i = 0;
    for (let k = 0; k < stations.length; k += 1) {
      const st = stations[k];
      if (st && s >= st.arrive) i = k;
    }
    const here = stations[i] ?? first;
    const next = stations[i + 1];
    if (!next || s <= here.leave) {
      const p = place(i, s);
      const a = here.anchor;
      return {
        ...p,
        restTurn: here.turn,
        face: here.face,
        station: a.id,
        travelling: 0,
        parked: i > 0 && Math.hypot(p.x - a.x, p.y - (a.y - carried(a, s))) > 1,
        from: here.anchor.id,
        to: here.anchor.id,
        u: 0,
      };
    }
    const u = clamp01((s - here.leave) / Math.max(1, next.arrive - here.leave));
    const near = u < 0.5 ? here : next;
    if (settled && i >= 3) {
      // At rest between two plain anchors: on to the nearer one, where there is room for it.
      const k = u < 0.5 ? i : i + 1;
      const p = place(k, s);
      const a = near.anchor;
      return {
        ...p,
        restTurn: near.turn,
        face: near.face,
        station: a.id,
        travelling: 0,
        parked: Math.hypot(p.x - a.x, p.y - (a.y - carried(a, s))) > 1,
        from: here.anchor.id,
        to: next.anchor.id,
        u,
      };
    }
    const p = route(i, place(i, s), place(i + 1, s), u);
    return {
      ...p,
      restTurn: mix(here.turn, next.turn, easeInOutSine(u)),
      face: near.face,
      station: near.anchor.id,
      travelling: Math.pow(bump(u), 0.6),
      parked: false,
      from: here.anchor.id,
      to: next.anchor.id,
      u,
    };
  };

  const side = (scroll: number): Side => {
    if (!hero || !perch) return "behind";
    const next = stations[2];
    const out = next ? mix(perch.leave, next.arrive, hopAt) : perch.leave;
    if (scroll >= out) return "front";
    if (!crossing) return "behind";
    const u = scroll / Math.max(1, perch.arrive);
    return u > CROSS_START && u < CROSS_END ? "front" : "behind";
  };

  const center = stations[2];
  const dock = stations[3];
  return {
    layout,
    win,
    stations: stations.map((s) => ({ id: s.anchor.id, arrive: s.arrive, leave: s.leave })),
    spin: {
      from: (center?.arrive ?? 0) - 0.3 * vh,
      to: dock?.arrive ?? 0,
    },
    crossing,
    side,
    clear: () => {
      const p = perch ? place(1, perch.arrive) : { x: vw / 2, y: vh / 2, size: 100 };
      return clearPlace(win, navH, p);
    },
    film: (scroll) => filmBox(layout.slot, win, Math.max(0, scroll), vh),
    at,
  };
}

/**
 * The place just above the window where nothing of the drone is behind it: its centre over the
 * perch, its size drawn in if the space under the bar is small. The drone changes sides of the
 * film here (`layering.ts`), where the change cannot be seen.
 */
function clearPlace(win: Box, navH: number, perch: Place): Place {
  const room = win.y - navH - EDGE;
  const size = Math.max(40, Math.min(perch.size * 0.88, (room - 4) / (0.5 + CLEAR_REACH)));
  return { x: perch.x, y: win.y - CLEAR_REACH * size - 4, size };
}
