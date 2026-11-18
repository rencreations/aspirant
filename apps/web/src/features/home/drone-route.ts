/**
 * Where the normal drone is for the first four sections of the home (hero, aspirants, rows, strip).
 * It follows the visitor's journey: it rests at the lower right after the intro (joint J0 of the
 * design), drifts under the cards, waits under the text of the aspirants, floats over the angled
 * rows and leaves to the upper right during the hold of the strip (joint J4). A pure function of
 * the scroll in screens, so every section that carries the drone agrees at its joints without
 * seeing the others. The sections place the actor from it every frame and may add a flourish that
 * returns to the route at its ends. Stage pixels, y up, the origin at the middle of the screen.
 *
 * A stop is placed from a section: its start plus a share of its length, on the story axis
 * (`sections/story.ts`: the unit the scenes of these sections are written in, which is not the
 * scroll the visitor spends since the scenes became plays). A share is written as screens over the
 * section's old length (`1.2 / 4.2`), which is where the number came from. The callers pass the story
 * position of their scene as `S`.
 */
import { STORY, type StoryId } from "./sections/story";

/** A stop of the route: the section it is measured from, the share of its length, then x, y and height as fractions of the viewport. */
type RelStop = readonly [from: StoryId, share: number, x: number, y: number, height: number];
/** A stop placed on the scroll: screens, then x, y and height. */
type Stop = readonly [screens: number, x: number, y: number, height: number];

/**
 * J0: x +0.30 W, y -0.22 H, 0.17 H tall (the end of the intro). The aspirants hold (4.2 to 5.0)
 * keeps the drone under the text on the right. The exit leaves the viewport by the upper right.
 */
const STOPS: readonly RelStop[] = [
  ["hero", 0, 0.3, -0.22, 0.17],
  ["hero", 1.2 / 4.2, 0.36, -0.28, 0.15],
  ["hero", 2.6 / 4.2, -0.38, -0.3, 0.14],
  ["aspirants", 0, 0.38, -0.34, 0.13],
  ["aspirants", 0.8 / 1.6, 0.38, -0.34, 0.13],
  ["rows", 0.8 / 2.4, -0.4, 0.32, 0.12],
  ["rows", 1.8 / 2.4, 0.4, -0.3, 0.12],
  ["strip", 0, 0.4, -0.3, 0.12],
  ["strip", 1.5 / 3.1, 0.4, -0.3, 0.12],
  ["strip", 2.4 / 3.1, 0.8, 0.62, 0.1],
];

/**
 * The route of a narrow or upright screen (a phone, a tablet held upright). The drone is a little smaller and stays
 * clear of the right edge, so its wing is never cut at rest (joint J0: its reach is about 1.2 of its
 * height to the side), and in the aspirants it stands over the wall's corner, because the words
 * stand under the wall there. Same scroll stops, same joints.
 */
const COMPACT_STOPS: readonly RelStop[] = [
  ["hero", 0, 0.12, -0.27, 0.133],
  ["hero", 1.2 / 4.2, 0.18, -0.3, 0.12],
  ["hero", 2.6 / 4.2, -0.2, -0.3, 0.115],
  ["aspirants", 0, 0.2, 0.3, 0.1],
  ["aspirants", 0.8 / 1.6, 0.2, 0.3, 0.1],
  ["rows", 0.8 / 2.4, -0.22, 0.32, 0.1],
  ["rows", 1.8 / 2.4, 0.2, -0.3, 0.1],
  ["strip", 0, 0.2, -0.3, 0.1],
  ["strip", 1.5 / 3.1, 0.2, -0.36, 0.1],
  ["strip", 2.4 / 3.1, 0.8, 0.62, 0.1],
];

/** The route placed on the story axis, made once. */
let placed: { wide: readonly Stop[]; compact: readonly Stop[] } | null = null;
const place = (stops: readonly RelStop[]): Stop[] =>
  stops.map(([from, share, x, y, h]): Stop => [
    STORY[from].start + share * STORY[from].length,
    x,
    y,
    h,
  ]);
function placedRoute(): { wide: readonly Stop[]; compact: readonly Stop[] } {
  placed ??= { wide: place(STOPS), compact: place(COMPACT_STOPS) };
  return placed;
}

/** A viewport narrower than this (in CSS px), or taller than it is wide, takes the compact route. */
export const COMPACT_ROUTE_W = 700;

/** True for the screens whose words stand under the wall (the layout's tall rule) and for narrow ones. */
export const isCompactView = (w: number, h: number): boolean => w < COMPACT_ROUTE_W || w <= h;

/** From this scroll on the drone has left the screen: the route stops drawing it (its last stop). */
export const routeEnd = (): number => placedRoute().wide[STOPS.length - 1]![0];

export interface DroneRoutePlace {
  /** Stage pixels. */
  x: number;
  y: number;
  /** On-screen height in CSS pixels. */
  height: number;
  /** False once the drone has left the screen (and the route has ended). */
  visible: boolean;
}

const stopAt = (stops: readonly Stop[], i: number): Stop =>
  stops[Math.min(stops.length - 1, i)] ?? stops[0]!;

const smooth = (u: number): number => u * u * (3 - 2 * u);

/** The drone's place at `S` screens for a viewport of `w` by `h`. Writes into `out` and returns it. */
export function routeAt(
  S: number,
  viewport: { readonly w: number; readonly h: number },
  out: DroneRoutePlace,
): DroneRoutePlace {
  const route = placedRoute();
  const stops = isCompactView(viewport.w, viewport.h) ? route.compact : route.wide;
  const last = stops.length - 1;
  let i = 0;
  while (i < last - 1 && S >= stopAt(stops, i + 1)[0]) i += 1;
  const a = stopAt(stops, i);
  const b = stopAt(stops, i + 1);
  const span = b[0] - a[0];
  const u = span > 0 ? Math.min(1, Math.max(0, (S - a[0]) / span)) : 1;
  const e = smooth(u);
  out.x = (a[1] + (b[1] - a[1]) * e) * viewport.w;
  out.y = (a[2] + (b[2] - a[2]) * e) * viewport.h;
  out.height = (a[3] + (b[3] - a[3]) * e) * viewport.h;
  out.visible = S < routeEnd();
  return out;
}

/** A place to write into (one per section, made once). */
export function newRoutePlace(): DroneRoutePlace {
  return { x: 0, y: 0, height: 0, visible: true };
}
