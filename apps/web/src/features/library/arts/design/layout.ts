import type { LibImage } from "../../types";

/**
 * How big a sheet stands in the page, and so which size of the file it asks for. The page sizes a
 * sheet in CSS (`design.module.css`: the width is the smallest of the room it has, the height cap
 * times its shape and its own pixels). This file does the same sum for the loading list and for
 * the choice between the preview and the full size, so the bar waits for the file the page draws.
 * Keep the numbers in step with the style sheet.
 */

/** From this width the notes stand beside the sheet; below it they stand above and below it. */
export const WIDE_AT = 901;
/** From this width the index of the sheets stands at the right edge. */
export const RAIL_AT = 1100;
/** A sheet is at most this tall, in screen heights, and never above `CAP_MAX` pixels. */
const CAP_VH = 0.72;
export const CAP_MAX = 832;
/** The notes column and the space between it and the sheet, in pixels (15 and 3 rem). */
const SIDE_W = 240;
const COL_GAP = 48;
/** The widest the room gets (112 rem). */
const ROOM_MAX = 1792;
/** The long side of the preview (`p`) of a sheet. */
const PREVIEW_LONG = 1280;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The page gutter at a width, from `--gutter` in `styles/tokens.css`. */
function gutterOf(vw: number): number {
  return vw >= WIDE_AT ? clamp(35.2 + 0.025641 * vw, 56, 112) : clamp(7.8 + 0.025641 * vw, 16, 96);
}

/** The padding around a sheet on its plate. */
function plateOf(vw: number): number {
  return clamp(0.024 * vw, 12, 36);
}

/** The tallest a sheet gets on a screen of this height. */
export function capHeight(vh: number): number {
  return Math.min(CAP_VH * vh, CAP_MAX);
}

/** The width in CSS pixels at which a sheet stands, never above its own pixels. */
export function sheetWidth(img: Pick<LibImage, "w" | "h">, vw: number, vh: number): number {
  const wide = vw >= WIDE_AT;
  const room = Math.min(vw, ROOM_MAX) - 2 * gutterOf(vw) - (wide ? SIDE_W + COL_GAP : 0);
  const inner = room - 2 * plateOf(vw);
  const ratio = img.w / Math.max(1, img.h);
  return Math.max(1, Math.min(inner, capHeight(vh) * ratio, img.w));
}

/** The pixel width of the preview of a sheet (`p`): 1280 on the long side, never above its own size. */
export function previewWidth(img: Pick<LibImage, "w" | "h">): number {
  return Math.round(img.w * Math.min(1, PREVIEW_LONG / Math.max(img.w, img.h)));
}

/**
 * The key to draw a sheet from: the preview, unless the screen needs more pixels than the preview
 * has (a big sheet on a sharp screen) and the full size has them. The thumbnail is never drawn.
 */
export function sheetKey(img: LibImage, vw: number, vh: number, dpr: number): string {
  const need = sheetWidth(img, vw, vh) * Math.max(1, dpr);
  const have = previewWidth(img);
  return have < img.w && need > have * 1.1 ? img.f : img.p;
}

/**
 * How far from a section's top the page should stop so the section stands in the middle of a screen
 * of height `vh` under a bar of `bar` pixels. A section too tall to centre stands just under the bar.
 */
export function alignOffset(h: number, vh: number, bar: number): number {
  return h + bar + 24 < vh ? -(vh - h) / 2 : -(bar + 16);
}
