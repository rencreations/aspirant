/**
 * Character palettes as page tokens.
 *
 * The palette hexes come from the official art and are often too light (Selena's pale blue on
 * ceramic) or too dark (Ruby's navy on void black) to carry text. `characterVars` turns a
 * palette into `--accent`, `--accent-2`, `--glow` and `--on-accent` values that read at
 * 4.5:1 or more on every surface of the character's world, and keeps the raw colours as
 * `--c-*` for glows, particles and art overlays.
 */
import type { CSSProperties } from "react";

import type { Palette, Side } from "@/content/types";

type Rgb = readonly [number, number, number];

/** The surfaces of each world (tokens.css): page, raised and panel backgrounds. */
const SURFACES: Record<Side, readonly string[]> = {
  daybreak: ["#f4f6f9", "#e9edf2", "#ffffff"],
  storm: ["#05070c", "#0a0e16", "#0e141f"],
};

/** What a colour is pushed toward until it reads: ink on ceramic, light on void black. */
const TOWARD: Record<Side, string> = { daybreak: "#0b111c", storm: "#eef3fa" };

const INK = "#05070c";
const WHITE = "#ffffff";

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Linear mix of two hex colours in sRGB: t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

/**
 * The colour itself when it already reads at `min` against every surface of the world,
 * otherwise the smallest step toward ink (Daybreak) or light (Storm) that does.
 */
export function readable(color: string, side: Side, min = 4.5): string {
  const surfaces = SURFACES[side];
  const ok = (c: string) => surfaces.every((s) => contrast(c, s) >= min);
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const candidate = mix(color, TOWARD[side], t);
    if (ok(candidate)) return candidate;
  }
  return TOWARD[side];
}

/** Ink or white, whichever reads better on a fill of `color`. */
export function onColor(color: string): string {
  return contrast(color, INK) >= contrast(color, WHITE) ? INK : WHITE;
}

type PaletteKey = keyof Palette;

/** Which palette colours lead a character's page (art direction, see `art.ts`). */
export interface AccentChoice {
  readonly accent: PaletteKey;
  readonly accent2: PaletteKey;
}

/** Text-safe accent tokens and the raw palette, for a wrapper's `style`. */
export function characterVars(palette: Palette, side: Side, choice: AccentChoice): CSSProperties {
  const accent = readable(palette[choice.accent], side);
  const accent2 = readable(palette[choice.accent2], side);
  // Light glows vanish on ceramic, so Daybreak glows in the signature colour instead.
  const glow = side === "storm" ? palette.glow : palette[choice.accent];
  return {
    "--accent": accent,
    "--accent-2": accent2,
    "--glow": glow,
    "--on-accent": onColor(accent),
    "--c-primary": palette.primary,
    "--c-secondary": palette.secondary,
    "--c-glow": palette.glow,
    "--c-ink": palette.ink,
    "--c-lead": palette[choice.accent],
  } as CSSProperties;
}
