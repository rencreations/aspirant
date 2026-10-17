/**
 * Layout of the opening scene: Dawnbreak above, Terrinia on its lake shore, the Defence
 * Sphere over the city, Selrick Academy as one tall tower. Everything is a fraction of the
 * stage, so the canvas and the HTML callouts agree without sharing pixels.
 */
import { mulberry32 } from "@/lib/math";

export type SceneFocus = "dawnbreak" | "terrinia" | "selrick-academy" | "defence-sphere";

export interface Building {
  /** Left edge, 0 to 1 of the stage width. */
  readonly x: number;
  readonly w: number;
  /** Height as a fraction of the stage height. */
  readonly h: number;
  readonly spire: boolean;
}

export interface Hex {
  /** Position in stage pixels. */
  readonly x: number;
  readonly y: number;
  /** 0 at the apex, 1 at the rim, for the idle pulse. */
  readonly depth: number;
  readonly rim: boolean;
}

export interface Layout {
  readonly w: number;
  readonly h: number;
  /** Where the city meets the lake (y, px). */
  readonly shoreY: number;
  /** Dome centre and radii (px). */
  readonly domeX: number;
  readonly domeRx: number;
  readonly domeRy: number;
  readonly hexR: number;
  readonly hexes: readonly Hex[];
  readonly planet: { readonly x: number; readonly y: number; readonly r: number };
  /** The Academy tower: base centre x, top y. */
  readonly academy: { readonly x: number; readonly top: number; readonly w: number };
}

/** City silhouette, deterministic so the server and every resize agree. */
export const CITY: readonly Building[] = (() => {
  const rand = mulberry32(978);
  const out: Building[] = [];
  let x = 0.12;
  while (x < 0.88) {
    const w = 0.012 + rand() * 0.02;
    const centre = 1 - Math.abs((x + w / 2 - 0.5) / 0.38);
    const h = 0.05 + Math.max(0, centre) * 0.1 + rand() * 0.07;
    out.push({ x, w, h, spire: rand() > 0.78 });
    x += w + rand() * 0.004;
  }
  return out;
})();

/** The Academy tower stands right of centre. */
export const ACADEMY_X = 0.64;

/** Build the layout for a stage of `w` by `h` pixels. */
export function makeLayout(w: number, h: number): Layout {
  const narrow = w / h < 1.25;
  const shoreY = h * (narrow ? 0.7 : 0.72);
  const domeX = w * 0.5;
  const domeRx = w * (narrow ? 0.47 : 0.34);
  const domeRy = Math.min(shoreY * 0.9, domeRx * (narrow ? 1.05 : 0.9));
  const hexR = Math.max(11, Math.min(24, w / (narrow ? 20 : 40)));

  const hexes: Hex[] = [];
  const colStep = hexR * 1.5;
  const rowStep = hexR * Math.sqrt(3);
  const cols = Math.ceil(domeRx / colStep) + 1;
  for (let c = -cols; c <= cols; c++) {
    const x = domeX + c * colStep;
    const offset = Math.abs(c) % 2 === 1 ? rowStep / 2 : 0;
    for (let y = shoreY - rowStep * 0.35 - offset; y > shoreY - domeRy - rowStep; y -= rowStep) {
      const nx = (x - domeX) / domeRx;
      const ny = (shoreY - y) / domeRy;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      hexes.push({ x, y, depth: Math.sqrt(d), rim: d > 0.74 });
    }
  }

  return {
    w,
    h,
    shoreY,
    domeX,
    domeRx,
    domeRy,
    hexR,
    hexes,
    planet: {
      x: w * (narrow ? 0.84 : 0.88),
      y: h * (narrow ? 0.12 : 0.2),
      r: Math.min(w, h) * 0.1,
    },
    academy: {
      x: w * ACADEMY_X,
      top: shoreY - h * (narrow ? 0.33 : 0.38),
      w: Math.max(10, w * 0.016),
    },
  };
}

/** Where each callout sits, as a percentage of the stage (matches the canvas). */
export function calloutAt(layout: Layout, id: SceneFocus): { x: number; y: number } {
  const { w, h } = layout;
  switch (id) {
    case "dawnbreak":
      return { x: (layout.planet.x / w) * 100, y: ((layout.planet.y + layout.planet.r) / h) * 100 };
    case "terrinia":
      return { x: 0.3 * 100, y: ((layout.shoreY - h * 0.06) / h) * 100 };
    case "selrick-academy":
      return { x: (layout.academy.x / w) * 100, y: (layout.academy.top / h) * 100 };
    case "defence-sphere":
      return { x: (layout.domeX / w) * 100, y: ((layout.shoreY - layout.domeRy) / h) * 100 };
  }
}
