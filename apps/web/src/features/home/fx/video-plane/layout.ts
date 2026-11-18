/**
 * Where the film's frame stands on a screen: the scene box of the Psychoactive hero (digest
 * `ref-psychoactive-tib.md` 1.2), the strip, the window it expands to and the stage of the floating
 * previews. Plain numbers, no three.js, so the section's DOM (the centre line, the corner dots, the
 * labels) and the GL plane import the same rectangles and cannot drift apart.
 *
 * Boxes are in CSS pixels from the top left, like the DOM. The stage's own frame (origin in the
 * middle, y up) is reached with `toFrame`.
 *
 * The scene is `aspect-ratio: 2` and as wide as the screen less a pad of `max(160, 50vw - 800)` on
 * both sides, at most 1600 px. The strip is that frame of a 16:9 player scaled to 0.45 with a band
 * of 3.70 to 1 left visible (`inset(25.97%)`). The expand scales it to 1 and opens the band. On a
 * portrait screen the reference's own rules apply (scene as wide as the screen less 24 px, strip at
 * 0.7, inset 21.98%): the same scene reflowed, never a second version.
 */

/** A rectangle in CSS pixels from the top left. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WINDOW_ASPECT = 16 / 9;

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

function isPortrait(vw: number, vh: number): boolean {
  return vh > vw;
}

/** The scale of the strip against the full window, and the share of the window's height clipped at each side. */
export function stripLook(vw: number, vh: number): { scale: number; inset: number } {
  return isPortrait(vw, vh) ? { scale: 0.7, inset: 0.2198 } : { scale: 0.45, inset: 0.2597 };
}

/** The width of the full window (`W` of the digest). */
export function sceneWidth(vw: number, vh: number, aspect = WINDOW_ASPECT): number {
  const pad = isPortrait(vw, vh) ? 24 : Math.max(160, vw / 2 - 800);
  const wide = Math.min(1600, vw - 2 * pad);
  // A window never taller than the screen less the bar's room (the digest's own `100svh - 96px`).
  return Math.max(1, Math.min(wide, (vh - 96) * aspect));
}

/** The box the reference lays everything in (2 to 1 on a wide screen, the padded column on a tall one). */
export function sceneBox(vw: number, vh: number, out: Box = { x: 0, y: 0, w: 0, h: 0 }): Box {
  const w = sceneWidth(vw, vh);
  if (isPortrait(vw, vh)) {
    out.x = (vw - w) / 2;
    out.y = 160;
    out.w = w;
    out.h = Math.max(1, vh - 160 - 48);
    return out;
  }
  out.w = w;
  out.h = w / 2;
  out.x = (vw - w) / 2;
  out.y = (vh - out.h) / 2;
  return out;
}

/** The centre of the scene, which is where the strip, the window and the orbit are centred. */
export function sceneCentre(vw: number, vh: number): { x: number; y: number } {
  const b = sceneBox(vw, vh);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/**
 * The frame at an expand `e` (0 the strip, 1 the full window): the digest scales the whole player
 * from 0.45 to 1 and opens the band by the same step, so the width is `s W` and the height
 * `s (W / aspect) (1 - 2 inset)`. The picture is not touched: the frame only opens.
 */
export function expandBox(
  vw: number,
  vh: number,
  e: number,
  aspect = WINDOW_ASPECT,
  out: Box = { x: 0, y: 0, w: 0, h: 0 },
): Box {
  const { scale, inset } = stripLook(vw, vh);
  const k = clamp(e, 0, 1);
  const s = mix(scale, 1, k);
  const cut = mix(inset, 0, k);
  const W = sceneWidth(vw, vh, aspect);
  const c = sceneCentre(vw, vh);
  out.w = s * W;
  out.h = ((s * W) / aspect) * (1 - 2 * cut);
  out.x = c.x - out.w / 2;
  out.y = c.y - out.h / 2;
  return out;
}

/** The strip at rest: 502 by 136 at 1440 by 900 (the digest's 3.70 to 1). */
export function stripBox(vw: number, vh: number, out?: Box): Box {
  return expandBox(vw, vh, 0, WINDOW_ASPECT, out);
}

/** The full window: the scene's width at 16 to 9. */
export function windowBox(vw: number, vh: number, aspect = WINDOW_ASPECT, out?: Box): Box {
  return expandBox(vw, vh, 1, aspect, out);
}

/** The width of a preview card of the orbit (digest 1.7: `clamp(150px, 14vw, 270px)`). */
export function orbitCardWidth(vw: number, vh: number): number {
  return isPortrait(vw, vh) ? clamp(0.3 * vw, 104, 150) : clamp(0.14 * vw, 150, 270);
}

/** The orbit's stage: as wide as the scene, `min(clamp(560, 44vw, 800), vh - 96)` high, at the scene's centre. */
export function orbitStage(vw: number, vh: number, out: Box = { x: 0, y: 0, w: 0, h: 0 }): Box {
  const w = sceneWidth(vw, vh);
  const h = Math.max(1, Math.min(clamp(0.44 * vw, 560, 800), vh - 96));
  const c = sceneCentre(vw, vh);
  out.w = w;
  out.h = h;
  out.x = c.x - w / 2;
  out.y = c.y - h / 2;
  return out;
}

/** A box's centre in the stage's frame (origin in the middle, y up). */
export function toFrame(b: Box, vw: number, vh: number): { x: number; y: number } {
  return { x: b.x + b.w / 2 - vw / 2, y: vh / 2 - (b.y + b.h / 2) };
}
