/**
 * The dock: where the pair rest at the bottom right while the list is on (round six, 20 Nov 2026).
 * The numbers are the contract of `docs/design/home/round6-DESC-descent.md` section 4: the drone's
 * place, the same frame as `drone.place` (stage pixels, origin in the middle, y up). The doll sits on
 * the drone's head, so the pair is about 1.45 drone heights tall.
 */
import { isCompactView } from "../../drone-route";

/** Fractions of the screen: x of the width, y of the height (y up), the drone's height of the height. */
export interface DockFrac {
  readonly x: number;
  readonly y: number;
  readonly h: number;
}

const WIDE: DockFrac = { x: 0.385, y: -0.27, h: 0.14 };
const COMPACT: DockFrac = { x: 0.24, y: -0.32, h: 0.09 };

export const dockFrac = (compact: boolean): DockFrac => (compact ? COMPACT : WIDE);

export interface DockPlace {
  x: number;
  y: number;
  height: number;
}

/** The dock as a drone place. Writes `out` and returns it. */
export function dockPlace<T extends DockPlace>(
  viewport: { readonly w: number; readonly h: number },
  out: T,
): T {
  const d = dockFrac(isCompactView(viewport.w, viewport.h));
  out.x = d.x * viewport.w;
  out.y = d.y * viewport.h;
  out.height = d.h * viewport.h;
  return out;
}
