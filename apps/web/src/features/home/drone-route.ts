/**
 * Where the normal drone is for the first four sections of the home (hero, aspirants, rows, strip).
 * It follows the visitor's journey: it rests at the lower right after the intro (joint J0 of the
 * design), drifts under the cards, waits under the text of the aspirants, floats over the angled
 * rows and leaves to the upper right during the hold of the strip (joint J4). A pure function of
 * the scroll in screens, so every section that carries the drone agrees at its joints without
 * seeing the others. The sections place the actor from it every frame and may add a flourish that
 * returns to the route at its ends. Stage pixels, y up, the origin at the middle of the screen.
 */

/** A stop of the route: screens, then x, y and height as fractions of the viewport. */
type Stop = readonly [screens: number, x: number, y: number, height: number];

/**
 * J0: x +0.30 W, y -0.22 H, 0.17 H tall (the end of the intro). The aspirants hold (4.2 to 5.0)
 * keeps the drone under the text on the right. The exit leaves the viewport by the upper right.
 */
const STOPS: readonly Stop[] = [
  [0, 0.3, -0.22, 0.17],
  [1.2, 0.36, -0.28, 0.15],
  [2.6, -0.38, -0.3, 0.14],
  [4.2, 0.38, -0.34, 0.13],
  [5, 0.38, -0.34, 0.13],
  [6.6, -0.4, 0.32, 0.12],
  [7.6, 0.4, 0.3, 0.12],
  [8.2, 0.4, -0.3, 0.12],
  [9.4, 0.4, -0.3, 0.12],
  [10.4, 0.8, 0.62, 0.1],
];

/** From this scroll on the drone has left the screen: the route stops drawing it. */
export const ROUTE_END = 10.4;

export interface DroneRoutePlace {
  /** Stage pixels. */
  x: number;
  y: number;
  /** On-screen height in CSS pixels. */
  height: number;
  /** False once the drone has left the screen (and the route has ended). */
  visible: boolean;
}

const stopAt = (i: number): Stop => STOPS[Math.min(STOPS.length - 1, i)] ?? STOPS[0]!;

const smooth = (u: number): number => u * u * (3 - 2 * u);

/** The drone's place at `S` screens for a viewport of `w` by `h`. Writes into `out` and returns it. */
export function routeAt(
  S: number,
  viewport: { readonly w: number; readonly h: number },
  out: DroneRoutePlace,
): DroneRoutePlace {
  const last = STOPS.length - 1;
  let i = 0;
  while (i < last - 1 && S >= stopAt(i + 1)[0]) i += 1;
  const a = stopAt(i);
  const b = stopAt(i + 1);
  const span = b[0] - a[0];
  const u = span > 0 ? Math.min(1, Math.max(0, (S - a[0]) / span)) : 1;
  const e = smooth(u);
  out.x = (a[1] + (b[1] - a[1]) * e) * viewport.w;
  out.y = (a[2] + (b[2] - a[2]) * e) * viewport.h;
  out.height = (a[3] + (b[3] - a[3]) * e) * viewport.h;
  out.visible = S < ROUTE_END;
  return out;
}

/** A place to write into (one per section, made once). */
export function newRoutePlace(): DroneRoutePlace {
  return { x: 0, y: 0, height: 0, visible: true };
}
