/**
 * Where the pair (the drone with the doll on its head) are along the descent, as a pure function of
 * `u`, the scroll in screens from the section's start (round six, 20 Nov 2026). Stage pixels, y up,
 * the origin in the middle. The numbers are the drone's place: the doll rides on its head.
 *
 * The path is a slow lazy weave that goes down the screen: nine stops a little over two thirds of a
 * screen apart, a cubic Hermite curve through them (zero speed at the two ends, so the pair come to
 * rest at the dock), the weave wide enough to dance in and the fall slow enough to read as floating.
 * The pair come in from above the top edge while the strip's film is still flying off, they grow a
 * little as they come closer, and the last stop is the dock (`dock.ts`): the same place and size.
 */
import { isCompactView } from "../../drone-route";

import { dockFrac } from "./dock";
import { DESCENT_SCREENS, PAIR_FROM_U } from "./stations";

/** A stop: x and y as fractions of the width and the height (y up), the drone's height as a fraction of the height. */
type Stop = readonly [x: number, y: number, h: number];

const WIDE: readonly Stop[] = [
  [-0.14, 0.56, 0.085],
  [0.02, 0.26, 0.1],
  [0.24, 0.18, 0.12],
  [-0.18, 0.08, 0.14],
  [0.2, -0.02, 0.155],
  [-0.1, -0.1, 0.165],
  [0.12, -0.18, 0.165],
  [0.29, -0.23, 0.155],
  // The dock is written in `dock.ts`: the last stop is read from there.
  [0, 0, 0],
];

const COMPACT: readonly Stop[] = [
  [-0.1, 0.58, 0.06],
  [0.0, 0.28, 0.07],
  [0.18, 0.2, 0.08],
  [-0.18, 0.11, 0.09],
  [0.16, 0.01, 0.098],
  [-0.12, -0.08, 0.1],
  [0.1, -0.16, 0.1],
  [0.2, -0.24, 0.095],
  [0, 0, 0],
];

/** The stops, with the dock filled in as the last one. Made once per kind of screen. */
const stops = (compact: boolean): readonly Stop[] => {
  const base = compact ? COMPACT : WIDE;
  const d = dockFrac(compact);
  return [...base.slice(0, base.length - 1), [d.x, d.y, d.h]];
};
const MADE = { wide: stops(false), compact: stops(true) } as const;

/** The gap between two stops, in screens. */
const STOP_GAP = (DESCENT_SCREENS - PAIR_FROM_U) / (WIDE.length - 1);

export interface PairPlace {
  /** The drone's place, stage pixels. */
  x: number;
  y: number;
  /** The drone's on-screen height, CSS pixels. */
  height: number;
  /** False before the pair are on the page (above the top edge, at the start of the route). */
  visible: boolean;
  /** 0 to 1: how much they are flying DOWN (the drone's nose, its wings, her hair). */
  descent: number;
}

export const newPairPlace = (): PairPlace => ({
  x: 0,
  y: 0,
  height: 0,
  visible: false,
  descent: 0,
});

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Hermite between two stops with the given tangents (per segment). */
const hermite = (p0: number, p1: number, m0: number, m1: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1
  );
};

/** One component of the curve at the segment `i`, fraction `t`. The tangents are half the span of the neighbours. */
function component(list: readonly Stop[], k: 0 | 1 | 2, i: number, t: number): number {
  const last = list.length - 1;
  const p0 = list[i]![k];
  const p1 = list[i + 1]![k];
  const before = i === 0 ? p0 : list[i - 1]![k];
  const after = i + 1 === last ? p1 : list[i + 2]![k];
  const m0 = i === 0 ? 0 : (p1 - before) * 0.5;
  const m1 = i + 1 === last ? 0 : (after - p0) * 0.5;
  return hermite(p0, p1, m0, m1, t);
}

/** The pair's place at `u` for a screen of `w` by `h`. Writes `out` and returns it. */
export function pairAt(
  u: number,
  viewport: { readonly w: number; readonly h: number },
  out: PairPlace,
): PairPlace {
  const compact = isCompactView(viewport.w, viewport.h);
  const list = compact ? MADE.compact : MADE.wide;
  const segments = list.length - 1;
  const f = Math.min(segments - 1e-9, Math.max(0, (u - PAIR_FROM_U) / STOP_GAP));
  const i = Math.floor(f);
  const t = f - i;
  out.x = component(list, 0, i, t) * viewport.w;
  out.y = component(list, 1, i, t) * viewport.h;
  out.height = component(list, 2, i, t) * viewport.h;
  // Above the top edge there is nothing to draw: the pair appears once the drone's top is in the screen.
  out.visible = u > PAIR_FROM_U + 0.02 && u <= DESCENT_SCREENS + 1e-6;
  out.descent = descentAt(u);
  return out;
}

/**
 * How much they are flying down: they dive in, are busy through the middle, and ease to a hover as the dock
 * comes (the last screen). 0 before they enter and at the dock.
 */
export function descentAt(u: number): number {
  const into = clamp01((u - PAIR_FROM_U) / 0.9);
  const outOf = 1 - clamp01((u - (DESCENT_SCREENS - 0.9)) / 0.9);
  return into * outOf;
}
