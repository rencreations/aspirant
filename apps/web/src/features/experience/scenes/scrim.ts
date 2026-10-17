/**
 * Where the reader's text sits and in which theme, so the backdrop can stay legible under it.
 * `ThemeScrim` measures it from the DOM; the canvas composite reads it every frame.
 */
export type TextTheme = "storm" | "daybreak";

export interface ThemeZone {
  /** Viewport px, top and bottom. */
  y0: number;
  y1: number;
  theme: TextTheme;
}

export interface ScrimState {
  zones: ThemeZone[];
  /** Half width of the text column band, viewport px (centre is the viewport centre). */
  bandHalf: number;
  vw: number;
  vh: number;
}

export const scrimState: ScrimState = { zones: [], bandHalf: 400, vw: 1440, vh: 900 };

/*
 * Luminance budgets under body text, from the theme tokens: storm --text-dim #aab6c8 (L 0.46)
 * needs a backdrop at or below L 0.023 for 7:1; daybreak --text-dim #3c4859 (L 0.062) needs a
 * backdrop at or above L 0.734. The composite clamp and the veil in ThemeScrim keep to them.
 */
