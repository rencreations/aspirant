/**
 * Selena's frame at its two ends, and where the doll hangs: pure functions of the screen. The list
 * ends with the 4:5 frame grown into the whole screen, Selena in `city_idle`, the doll hanging by
 * one hand from the top edge (joint J8). The section after it (`selena`) starts from the same
 * numbers, so it imports this file for its first frame. Stage pixels (origin in the middle, y up)
 * for placements, CSS pixels (origin at the top left) for rectangles.
 */
import { ANCHOR, POSE_FIT, REF_HEIGHT } from "../../actors/selena/constants";
import { frameFor } from "../../actors/selena/framing";
import { isPortrait, type Vp } from "../hand/timeline";

import type { Rect } from "./layout";

/**
 * The width of the drawer of the section after the list, as a share of the screen (oryzo's 454.5
 * of 1440). On a phone the drawer is a sheet at the bottom and Selena has the upper part.
 */
export const DRAWER_SHARE = 0.315;
/**
 * The sky behind her (a CSS background): a dusk blue, lighter at the top left of the middle. The list
 * paints it in its own layer and holds it to the end of the section and through its tail; the section
 * after it draws the same sky (or lets this one fade over the tail).
 */
export const SKY =
  "radial-gradient(ellipse 70% 55% at 50% 38%, rgb(70 84 150 / 0.55), transparent 70%), linear-gradient(180deg, #151b38 0%, #0b0f22 62%, #060813 100%)";
/** The share of the free area her pose may take. */
const FILL_IDLE = 0.94;
const FILL_HANDS = 1.0;

export interface Placement {
  x: number;
  y: number;
  height: number;
}

/** The part of the screen Selena has once the drawer is open (CSS pixels). */
export function selenaFree(vp: Vp): Rect {
  if (isPortrait(vp)) return { x: 0, y: 0.06 * vp.h, w: vp.w, h: 0.56 * vp.h };
  return { x: DRAWER_SHARE * vp.w, y: 0, w: (1 - DRAWER_SHARE) * vp.w, h: vp.h };
}

/** The placement of her lying idle pose filling the free area: where she is at the end of the list. */
export function selenaEnd(vp: Vp): Placement {
  return frameFor(
    selenaFree(vp),
    vp,
    POSE_FIT.idle,
    { x: ANCHOR[0], y: ANCHOR[1] },
    REF_HEIGHT,
    FILL_IDLE,
  );
}

/** The placement that makes her standing pose (the hands at the mouth) fill a 4:5 frame. */
export function selenaInFrame(vp: Vp, frame: Rect): Placement {
  return frameFor(
    frame,
    vp,
    POSE_FIT.hands,
    { x: ANCHOR[0], y: ANCHOR[1] },
    REF_HEIGHT,
    FILL_HANDS,
  );
}

export interface DollHang {
  /** The doll's hand, where it holds the top edge (stage pixels). */
  x: number;
  y: number;
  /** Her height on the screen. */
  height: number;
}

/**
 * Where the doll hangs from the top: her hand on the screen's top edge, between the drawer's words
 * (which end at the drawer's edge) and the logo of the bar (which begins at 0.444 of the width on
 * a 16:10 screen), so the bar never covers her. On a phone she is at the right.
 */
export function dollHang(vp: Vp): DollHang {
  const portrait = isPortrait(vp);
  const xCss = portrait ? 0.82 * vp.w : (DRAWER_SHARE + 0.065) * vp.w;
  return {
    x: xCss - vp.w / 2,
    y: vp.h / 2 - 0.025 * vp.h,
    height: (portrait ? 0.15 : 0.165) * vp.h,
  };
}
