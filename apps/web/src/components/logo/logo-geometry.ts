import { LOGO } from "./logo-data.generated";

/** Width and height of the logo in its own units (the traced bitmap at half size). */
export const LOGO_W = LOGO.viewBox[2];
export const LOGO_H = LOGO.viewBox[3];

/** The widest point inside the letters: zooming here fills the screen with a letter window. */
export const PIVOT = LOGO.zoom;

export interface Camera {
  /** Screen pixels per logo unit. */
  k: number;
  /** Screen position of the pivot. */
  ox: number;
  oy: number;
}

export interface Layout {
  /** Rest scale (logo at its normal size). */
  k0: number;
  /** Scale at which one letter window covers the whole viewport. */
  kEnd: number;
  /** Screen position of the pivot at rest. */
  o0: { x: number; y: number };
  /** Screen position of the logo centre at rest. */
  centre: { x: number; y: number };
  /** Rest width and height of the logo in pixels. */
  width: number;
  height: number;
}

const ASPECT = LOGO_W / LOGO_H;

/** Where the logo sits at rest and how far it has to zoom to open onto the page. */
export function layoutFor(vw: number, vh: number): Layout {
  const wide = vw >= 700;
  const width = Math.min(vw * (wide ? 0.62 : 0.86), vh * 0.34 * ASPECT);
  const k0 = width / LOGO_W;
  const centre = { x: vw / 2, y: vh * 0.44 };
  const halfDiagonal = Math.hypot(vw, vh) / 2;
  const kEnd = Math.max(k0 * 2, (halfDiagonal * 1.06) / PIVOT.r);
  return {
    k0,
    kEnd,
    o0: {
      x: centre.x + k0 * (PIVOT.x - LOGO_W / 2),
      y: centre.y + k0 * (PIVOT.y - LOGO_H / 2),
    },
    centre,
    width,
    height: width / ASPECT,
  };
}

/**
 * The camera for zoom `u` (0 = logo at rest, 1 = a letter window fills the screen). The scale
 * grows exponentially so the zoom feels even, and the pivot slides to the screen centre.
 */
export function cameraAt(u: number, layout: Layout, vw: number, vh: number): Camera {
  const e = Math.min(1, Math.max(0, u));
  const k = layout.k0 * Math.pow(layout.kEnd / layout.k0, e);
  return {
    k,
    ox: layout.o0.x + (vw / 2 - layout.o0.x) * e,
    oy: layout.o0.y + (vh / 2 - layout.o0.y) * e,
  };
}

/** SVG transform that maps logo units to the screen for a camera. */
export function cameraTransform(c: Camera): string {
  return `translate(${c.ox.toFixed(2)} ${c.oy.toFixed(2)}) scale(${c.k.toFixed(5)}) translate(${-PIVOT.x} ${-PIVOT.y})`;
}

/**
 * Path data for a rectangle in logo units that covers the viewport, joined to the logo's outer
 * silhouette. With the even-odd rule it fills everything outside the logo.
 */
export function outsideRectPath(c: Camera, vw: number, vh: number): string {
  const m = 8;
  const x0 = PIVOT.x + (0 - c.ox) / c.k - m;
  const y0 = PIVOT.y + (0 - c.oy) / c.k - m;
  const x1 = PIVOT.x + (vw - c.ox) / c.k + m;
  const y1 = PIVOT.y + (vh - c.oy) / c.k + m;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}H${x1.toFixed(2)}V${y1.toFixed(2)}H${x0.toFixed(2)}Z${LOGO.silhouette}`;
}
