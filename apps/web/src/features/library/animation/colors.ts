import { contrast } from "./room-math";

/** A `#rrggbb` colour as three channels, 0 to 255. */
function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: number[]) =>
  `#${c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/** `a` mixed with `b`: `t` of `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + ((y[i] ?? 0) - v) * t));
}

interface Palette {
  primary: string;
  ink: string;
}

/**
 * The colour field behind the ring for one character, as the reference gives each item its own:
 * her primary colour deepened with her ink, as little as it takes for white type to read on it
 * (4.5 to 1), and a deeper tone of it for the far corner.
 */
export function fieldColors(palette: Palette): { main: string; deep: string } {
  let t = 0.4;
  let main = mixHex(palette.primary, palette.ink, t);
  while (contrast(main, "#ffffff") < 4.6 && t < 0.95) {
    t += 0.04;
    main = mixHex(palette.primary, palette.ink, t);
  }
  return { main, deep: mixHex(palette.primary, palette.ink, Math.min(0.92, t + 0.3)) };
}
