/**
 * The trailer plane's base pose: a pure function of the viewport and two numbers. `morph` takes it
 * from lying angled in the field's rows to standing upright as the strip, `expand` opens the strip
 * to the full window. Both are reversible: the same numbers always give the same pose.
 *
 * The angled state is the rows' own plane (the same rotation, the same card size and the same long
 * lens as the picture field's `rows`, read from `image-field/wall.ts`), so a trailer that appears
 * between the cards leans exactly as they do. The upright state is on the pixel plane at z = 0, so
 * any lens draws it the same.
 */
import { qSlerp, mix, smootherstep, type Q } from "../image-field/math";
import { wallGrid } from "../image-field/grid";
import { WALL_DISTANCE, type WallGeom } from "../image-field/wall";
import { expandBox, sceneWidth, toFrame, WINDOW_ASPECT } from "./layout";
import type { FilmState, PlanePose, Vp } from "./types";

/** The camera distance at which one unit is one pixel (the stage's `PIXEL_DISTANCE`). */
export const PIXEL_LENS = 1000;
/**
 * The geometry of the field's plane for a viewport: the same object the field's cards stand on (one
 * plane over the whole screen, `image-field/grid.ts`), so the film leans exactly as they do.
 */
export function rowsGeom(vp: Vp): WallGeom {
  return wallGrid(vp).geom;
}

/** The trailer draws over the field's cards and wins a hit against them (the order is a small bias). */
const HERO_ORDER = 120;

const IDENTITY: Q = [0, 0, 0, 1];

/** The corner radius of the strip and the window: 20 px at full size, scaled with the frame (digest 1.2). */
function windowCorner(w: number, vp: Vp): number {
  return 20 * (w / sceneWidth(vp.w, vp.h));
}

const boxScratch = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The trailer's base pose for a state: the angled card in the rows (`morph` 0), the strip
 * (`morph` 1, `expand` 0), the window (`expand` 1). A `heroBox` in the state replaces all of it.
 * Writes `out` and returns the lens that draws it (the rows' long one while it leans, the pixel one
 * once it stands).
 */
export function heroBase(vp: Vp, st: FilmState, out: PlanePose): number {
  if (st.heroBox) {
    const b = st.heroBox;
    const c = toFrame(b, vp.w, vp.h);
    out.x = c.x;
    out.y = c.y;
    out.z = 0;
    out.q[0] = out.q[1] = out.q[2] = 0;
    out.q[3] = 1;
    out.w = b.w;
    out.h = b.h;
    out.corner = windowCorner(b.w, vp);
    out.opacity = 1;
    out.order = HERO_ORDER;
    out.bend = 0;
    out.flutter = 0;
    return PIXEL_LENS;
  }

  const g = rowsGeom(vp);
  const m = smootherstep(st.morph);
  const a = smootherstep(st.appear);

  // The angled card: a place on the rows' plane, as large as a share of a rows card (16 to 9). It shows
  // at its full size (the rows' space is made for it) and only fades in: it never grows out of a small card.
  const u = st.angleU;
  const v = st.angleV;
  const grow = st.angleSize;
  const ax = g.frame.cx + u * g.right[0] + v * g.up[0];
  const ay = g.frame.cy + u * g.right[1] + v * g.up[1];
  const az = u * g.right[2] + v * g.up[2];
  const aw = g.cardW * grow;
  const ah = aw / WINDOW_ASPECT;

  // The strip or the window it has opened to.
  expandBox(vp.w, vp.h, st.expand, st.aspect, boxScratch);
  const centre = toFrame(boxScratch, vp.w, vp.h);

  out.x = mix(ax, centre.x, m);
  out.y = mix(ay, centre.y, m);
  out.z = mix(az, 0, m);
  qSlerp(g.q, IDENTITY, m, out.q);
  out.w = mix(aw, boxScratch.w, m);
  out.h = mix(ah, boxScratch.h, m);
  const cornerStrip = windowCorner(boxScratch.w, vp);
  out.corner = mix(0.06 * ah, cornerStrip, m);
  out.opacity = mix(a, 1, m);
  out.order = HERO_ORDER;
  out.bend = 0;
  out.flutter = 0;
  return mix(WALL_DISTANCE, PIXEL_LENS, m);
}
