import { AURORA } from "./aurora";
import { DOTS } from "./dots";
import { MAIN, PRELUDE } from "./glsl";
import { SILK } from "./silk";
import { TOPO } from "./topo";

/**
 * The backgrounds of the opening. One entry per background: change the `background` prop of
 * `Opening` (or press a button in the corner) and the scene swaps to it. To add one, write the
 * GLSL function (see topo.ts), give it a flat CSS look for the devices that cannot run it, and
 * list it here.
 */
export interface BackgroundDef {
  id: string;
  label: string;
  glsl: string;
  /** The flat look for weak devices and reduced motion: daybreak first, ink second. */
  css: { light: string; dark: string };
}

export const BACKGROUNDS = {
  topo: {
    id: "topo",
    label: "Contour",
    glsl: TOPO,
    css: {
      light:
        "radial-gradient(60% 50% at 80% 70%, #e9e3f4 0%, transparent 70%), radial-gradient(50% 45% at 15% 35%, #efeaf7 0%, transparent 70%), #f8f5fc",
      dark: "radial-gradient(60% 50% at 80% 70%, #1d1336 0%, transparent 70%), #140e26",
    },
  },
  silk: {
    id: "silk",
    label: "Silk",
    glsl: SILK,
    css: {
      light: "linear-gradient(120deg, #f1ecfa 0%, #cdb8f7 55%, #f4eefc 100%)",
      dark: "linear-gradient(120deg, #120c25 0%, #3b2570 55%, #140e26 100%)",
    },
  },
  aurora: {
    id: "aurora",
    label: "Aurora",
    glsl: AURORA,
    css: {
      light: "linear-gradient(100deg, #f7f3fc 10%, #e6d9f7 45%, #f6dcee 70%, #f7f3fc 100%)",
      dark: "linear-gradient(100deg, #120c25 10%, #2b1a5a 45%, #4a1a50 70%, #140e26 100%)",
    },
  },
  dots: {
    id: "dots",
    label: "Halftone",
    glsl: DOTS,
    css: {
      light:
        "radial-gradient(circle at 1px 1px, #cfc3ea 1.2px, transparent 1.6px) 0 0 / 22px 22px, #f8f5fc",
      dark: "radial-gradient(circle at 1px 1px, #3a2a6e 1.2px, transparent 1.6px) 0 0 / 22px 22px, #140e26",
    },
  },
} as const satisfies Record<string, BackgroundDef>;

export type BackgroundId = keyof typeof BACKGROUNDS;
export const DEFAULT_BACKGROUND: BackgroundId = "topo";
export const BACKGROUND_LIST: readonly BackgroundDef[] = Object.values(BACKGROUNDS);

export const isBackgroundId = (v: unknown): v is BackgroundId =>
  typeof v === "string" && v in BACKGROUNDS;

/** The fragment shader of a background: shared code, the entry's function, then `main`. */
export const fragmentOf = (id: BackgroundId) => PRELUDE + BACKGROUNDS[id].glsl + MAIN;
