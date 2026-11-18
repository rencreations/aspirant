/**
 * The logo as pixels. The vector (`LOGO`, traced by `scripts/logo/build.py`) is filled with `Path2D`
 * on a 2D canvas, layer by layer in the order of `LogoLayers`, into the two textures the quad
 * wears: the hero texture (the whole art at the size of the big logo) and the nav texture (the art
 * at the bar's own scale and sub-pixel phase). Browser only: `Path2D` is not in jsdom, so the sizes
 * are worked out in `math.ts` and tested there.
 *
 * The mascot is part of the picture (it does not blink on the big logo; the DOM one does). The
 * energy stroke and the shine are not drawn: they are invisible at rest in the DOM logo too.
 */
import { LOGO } from "@/components/logo/logo-data.generated";

import { heroTextureSize, REG, type NavRaster } from "./math";

/**
 * The colours of the artwork, the same in both themes. A copy of `LOGO_COLORS` in
 * `components/logo/logo-art.tsx`, which is not exported: change them together.
 */
const COLORS = {
  orange: "#f2b04c",
  ink: "#0b0b0e",
  pink: "#ff2e90",
  accent: "#6f6f6f",
  bevel: "#8d8d8d",
  letter: "#ffffff",
} as const;

/** Texels per device pixel across the art in the hero texture. */
export const OVERSAMPLE = 1.25;

interface Layer {
  path: Path2D;
  color: string;
}

let layers: Layer[] | null = null;

/** The paths in drawing order, parsed once. */
function getLayers(): Layer[] {
  if (layers) return layers;
  const make = (d: string, color: string): Layer => ({ path: new Path2D(d), color });
  layers = [
    make(LOGO.outline, COLORS.orange),
    make(LOGO.plate, COLORS.ink),
    make(LOGO.mascot.accent, COLORS.accent),
    make(LOGO.mascot.antL, COLORS.pink),
    make(LOGO.mascot.antR, COLORS.pink),
    make(LOGO.mascot.ring, COLORS.pink),
    ...LOGO.mascot.pods.map((d) => make(d, COLORS.pink)),
    make(LOGO.mascot.disc, COLORS.pink),
    ...LOGO.letters.map((l) => make(l.d, COLORS.letter)),
    make(LOGO.bevel, COLORS.bevel),
  ];
  return layers;
}

function paint(g: CanvasRenderingContext2D): void {
  for (const layer of getLayers()) {
    g.fillStyle = layer.color;
    g.fill(layer.path, "evenodd");
  }
}

function makeCanvas(
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no 2d canvas");
  return { canvas, g };
}

/** Texture A: the art and its margin, `texW` pixels wide. */
function rasterHero(texW: number): HTMLCanvasElement {
  const h = Math.round((REG.h * texW) / REG.w);
  const { canvas, g } = makeCanvas(texW, h);
  const s = texW / REG.w;
  g.scale(s, s);
  g.translate(-REG.x, -REG.y);
  paint(g);
  return canvas;
}

/** Texture B: the art on the canvas's pixel grid at the phase the browser draws the bar's logo. */
export function rasterNav(plan: NavRaster): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(plan.w, plan.h);
  g.translate(plan.drawX, plan.drawY);
  g.scale(plan.scale, plan.scale);
  paint(g);
  return canvas;
}

/** The silhouette as a coarse mask for the pointer: 1 where the logo is, `MASK_W` by `MASK_H`. */
export const MASK_W = 256;
export const MASK_H = 64;

export function rasterMask(): Uint8Array {
  const { canvas, g } = makeCanvas(MASK_W, MASK_H);
  g.scale(MASK_W / REG.w, MASK_H / REG.h);
  g.translate(-REG.x, -REG.y);
  g.fillStyle = "#000";
  g.fill(new Path2D(LOGO.silhouette), "evenodd");
  const data = g.getImageData(0, 0, MASK_W, MASK_H).data;
  const mask = new Uint8Array(MASK_W * MASK_H);
  for (let i = 0; i < mask.length; i += 1) mask[i] = (data[i * 4 + 3] ?? 0) > 96 ? 1 : 0;
  canvas.width = 0;
  return mask;
}

const warm = new Map<number, HTMLCanvasElement>();

/**
 * Make the hero texture for a screen ahead of time (the loading list does it) and keep it for the
 * actor. Returns the canvas. A second call for the same width gives the same canvas.
 */
export function heroCanvasFor(artCss: number, dpr: number): HTMLCanvasElement {
  const { w } = heroTextureSize(artCss, dpr, OVERSAMPLE);
  const known = warm.get(w);
  if (known) return known;
  const made = rasterHero(w);
  // Only the latest size is worth keeping: a resize makes a new one.
  warm.clear();
  warm.set(w, made);
  return made;
}
