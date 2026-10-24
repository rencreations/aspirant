import { MAIN, PRELUDE } from "./glsl";
import { TOPO } from "./topo";

/**
 * The background of the opening: contour lines and flat tints in lavender (topo.ts). The CSS look
 * is what weak devices and reduced motion get instead of the shader: daybreak first, ink second.
 */
export const BACKGROUND_CSS = {
  light:
    "radial-gradient(60% 50% at 80% 70%, #e9e3f4 0%, transparent 70%), radial-gradient(50% 45% at 15% 35%, #efeaf7 0%, transparent 70%), #f8f5fc",
  dark: "radial-gradient(60% 50% at 80% 70%, #1d1336 0%, transparent 70%), #140e26",
} as const;

/** The fragment shader: shared code, the contour function, then `main`. */
export const BACKGROUND_FRAGMENT = PRELUDE + TOPO + MAIN;
