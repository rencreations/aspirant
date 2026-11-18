/**
 * What a kind is made of: its shader and how it likes to be drawn. The palettes are in
 * `palettes.ts` (data only); this file holds the GLSL, so it is only imported by the renderer side.
 */
import { AIR, EARTH, FIRE, WATER } from "./glsl-elements";
import {
  AURORA,
  DARK_VEIL,
  IRIDESCENCE,
  LIQUID_CHROME,
  ORB,
  PLASMA,
  PRISM,
  SILK,
  SOFT_AURORA,
} from "./glsl-flow";
import {
  BEAMS,
  FLOATING_LINES,
  GRADIENT_BLINDS,
  HYPERSPEED,
  LIGHTNING,
  LIGHT_RAYS,
  SPEED_LINES,
  THREADS,
  WAVES,
} from "./glsl-lines";
import {
  DOT_GRID,
  GALAXY,
  GRID_DISTORTION,
  PARTICLES,
  PIXEL_BLAST,
  RIPPLE_GRID,
  SQUARES,
  STARS,
} from "./glsl-points";
import type { BackdropKind } from "./palettes";

export interface KindDef {
  /** The body of the kind (see `glsl-prelude.ts`). */
  readonly frag: string;
  /**
   * The buffer's size as a fraction of the canvas in CSS pixels. Soft kinds are 0.5 (the canvas is
   * stretched, which is a free blur), the crisp ones (hairlines, dots) ask for 1.5 and get the
   * display's own pixel ratio up to that. It depends on the kind, never on the device.
   */
  readonly res: number;
  /** How fast the kind's own time runs (1 is its natural pace). */
  readonly speed: number;
  readonly scale: number;
  /** The turn in degrees. */
  readonly angle: number;
}

const SOFT = 0.5;
const MID = 0.75;
const CRISP = 1.5;

export const KIND_DEFS: Readonly<Record<BackdropKind, KindDef>> = {
  aurora: { frag: AURORA, res: SOFT, speed: 1, scale: 1, angle: 0 },
  "soft-aurora": { frag: SOFT_AURORA, res: SOFT, speed: 1, scale: 1, angle: 0 },
  beams: { frag: BEAMS, res: MID, speed: 1, scale: 1, angle: 0 },
  particles: { frag: PARTICLES, res: SOFT, speed: 1, scale: 1, angle: 0 },
  "dark-veil": { frag: DARK_VEIL, res: SOFT, speed: 1, scale: 1, angle: 0 },
  silk: { frag: SILK, res: SOFT, speed: 1, scale: 1, angle: 0 },
  threads: { frag: THREADS, res: CRISP, speed: 1, scale: 1, angle: 0 },
  plasma: { frag: PLASMA, res: SOFT, speed: 1, scale: 1, angle: 0 },
  prism: { frag: PRISM, res: MID, speed: 1, scale: 1, angle: 0 },
  iridescence: { frag: IRIDESCENCE, res: SOFT, speed: 1, scale: 1, angle: 0 },
  "liquid-chrome": { frag: LIQUID_CHROME, res: SOFT, speed: 1, scale: 1, angle: 0 },
  lightning: { frag: LIGHTNING, res: MID, speed: 1, scale: 1, angle: 0 },
  orb: { frag: ORB, res: MID, speed: 1, scale: 1, angle: 0 },
  galaxy: { frag: GALAXY, res: MID, speed: 1, scale: 1, angle: 0 },
  stars: { frag: STARS, res: CRISP, speed: 1, scale: 1, angle: 0 },
  "ripple-grid": { frag: RIPPLE_GRID, res: CRISP, speed: 1, scale: 1, angle: 0 },
  squares: { frag: SQUARES, res: CRISP, speed: 1, scale: 1, angle: 0 },
  "dot-grid": { frag: DOT_GRID, res: CRISP, speed: 1, scale: 1, angle: 0 },
  "grid-distortion": { frag: GRID_DISTORTION, res: CRISP, speed: 1, scale: 1, angle: 0 },
  hyperspeed: { frag: HYPERSPEED, res: MID, speed: 1, scale: 1, angle: 0 },
  "speed-lines": { frag: SPEED_LINES, res: MID, speed: 1, scale: 1, angle: 0 },
  "gradient-blinds": { frag: GRADIENT_BLINDS, res: CRISP, speed: 1, scale: 1, angle: 0 },
  waves: { frag: WAVES, res: MID, speed: 1, scale: 1, angle: 0 },
  "light-rays": { frag: LIGHT_RAYS, res: SOFT, speed: 1, scale: 1, angle: 0 },
  "floating-lines": { frag: FLOATING_LINES, res: CRISP, speed: 1, scale: 1, angle: 0 },
  "pixel-blast": { frag: PIXEL_BLAST, res: 1, speed: 1, scale: 1, angle: 0 },
  earth: { frag: EARTH, res: MID, speed: 1, scale: 1, angle: 0 },
  air: { frag: AIR, res: MID, speed: 1, scale: 1, angle: 0 },
  water: { frag: WATER, res: MID, speed: 1, scale: 1, angle: 0 },
  fire: { frag: FIRE, res: SOFT, speed: 1, scale: 1, angle: 0 },
};
