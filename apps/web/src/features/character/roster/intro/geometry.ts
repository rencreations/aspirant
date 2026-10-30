import type { Slug } from "@/content/types";

import { SLASH, SLOTS, type Slot } from "../layout";
import type { PageBoxes } from "./gl/renderer";

/**
 * Where the panels are on the screen. The intro draws the roster's own slots, so the picture the
 * visitor sees at the end lines up with the page that is under it. `u` is the size of one board
 * unit in CSS pixels, (`ox`, `oy`) is where the board's origin is when the board is not scrolled.
 */
export interface View {
  w: number;
  h: number;
  u: number;
  ox: number;
  oy: number;
}

/**
 * The intro's own view: the board as the owner's recording shows it, where the panels are 895 px
 * tall on a 1080 px frame (a little bigger than the page's), starting 125 px from the top, and
 * lean a little more. Everything scales with the height of the window.
 */
const REF = { u: 2.39, top: 125, lean: 1.075, h: 1080 } as const;

export function introView(w: number, h: number): View {
  const k = h / REF.h;
  const u = REF.u * k;
  return { w, h, u, ox: 0, oy: REF.top * k - 5 * u };
}

/** The roster page marks every panel; the older mark is the fallback. */
export function panelElement(slug: Slug): Element | null {
  return (
    document.querySelector(`[data-roster-panel="${slug}"]`) ??
    document.querySelector(`li[data-slug="${slug}"]`)
  );
}

/** Read the board's scale and origin from one panel of the page. */
function viewFromPanel(
  w: number,
  h: number,
  slot: Slot,
  r: { left: number; top: number; width: number },
): View {
  const u = r.width / (slot.x2 - slot.x0);
  return { w, h, u, ox: r.left - slot.x0 * u, oy: r.top - slot.y0 * u };
}

export interface Quad {
  x0: number;
  x1: number;
  x2: number;
  x3: number;
  y0: number;
  y1: number;
}

/** Where the bottom left corner of the first panel stands when the picture appears (of the width). */
const ANCHOR = 0.6625;

/**
 * The corners of a slot in CSS pixels, as the recording draws them. The first panel (the last slot
 * of the row) stands at `ANCHOR` of the width when `shift` is 0, and the board is moved across by
 * `shift` board units while the panels arrive, so the whole row slides toward the right: the camera
 * pans toward the start of the row. The lean is a little steeper than the page's.
 */
export function quadOf(slot: Slot, view: View, shift: number, out: Quad): Quad {
  const { u, oy } = view;
  const first = slotOf(PANEL_FIRST);
  const base = ANCHOR * view.w - (first.x0 - shift) * u;
  const lean = (slot.x1 - slot.x0) * REF.lean;
  out.x0 = base + slot.x0 * u;
  out.x3 = base + slot.x3 * u;
  out.x1 = out.x0 + lean * u;
  out.x2 = out.x3 + lean * u;
  out.y0 = oy + slot.y0 * u;
  out.y1 = oy + slot.y1 * u;
  return out;
}

const PANEL_FIRST: Slug = "fanny";

export const slotOf = (slug: Slug): Slot => {
  const s = SLOTS.find((x) => x.slug === slug);
  if (!s) throw new Error(`no slot for ${slug}`);
  return s;
};

/** The picture's rectangle inside a panel, in CSS pixels, the way the page's own CSS places it. */
export function splashRect(slot: Slot, q: Quad): [number, number, number, number] {
  const pw = q.x2 - q.x0;
  const ph = q.y1 - q.y0;
  const picH = slot.zoom * ph;
  const picW = (16 / 9) * picH;
  const x = q.x0 + slot.tx * pw - slot.fx * picW;
  const y = q.y0 + slot.ty * ph - slot.fy * picH;
  return [x, y, picW, picH];
}

/** The clip, 20 by 9, covers the panel with its interesting part (the focus) in the middle. */
export function clipRect(
  q: Quad,
  focus: { x: number; y: number },
  aspect: number,
): [number, number, number, number] {
  const pw = q.x2 - q.x0;
  const ph = q.y1 - q.y0;
  const cx = q.x0 + pw / 2;
  const cy = q.y0 + ph / 2;
  const h = Math.max(ph, pw / aspect) * 1.45;
  const w = h * aspect;
  return [cx - focus.x * w, cy - focus.y * h, w, h];
}

/**
 * Where the real page has put Obsidia's panel and the red slash, for the layers that run over the
 * page after the flash. Read from the DOM, so they follow the page at any screen size.
 */
export function measurePage(w: number, h: number): PageBoxes | null {
  const slot = SLOTS.find((x) => x.slug === "obsidia");
  const el = panelElement("obsidia");
  if (!slot || !el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return null;
  const v = viewFromPanel(w, h, slot, r);
  const midY = (slot.y0 + slot.y1) / 2;
  const x = SLASH.x - SLASH.lean * (midY - SLASH.y);
  return {
    obsidia: { x: r.left, y: r.top, w: r.width, h: r.height },
    quad: {
      x0: v.ox + slot.x0 * v.u,
      x1: v.ox + slot.x1 * v.u,
      x2: v.ox + slot.x2 * v.u,
      x3: v.ox + slot.x3 * v.u,
      y0: v.oy + slot.y0 * v.u,
      y1: v.oy + slot.y1 * v.u,
    },
    slash: { x: v.ox + x * v.u, y: v.oy + midY * v.u, height: (slot.y1 - slot.y0) * v.u },
  };
}
