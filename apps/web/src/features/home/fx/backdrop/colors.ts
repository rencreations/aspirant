/**
 * Colours for the backdrop shaders. They are read as raw sRGB floats and written to the canvas as
 * they are (no linear conversion, like the picture field), so what a section writes in CSS is what
 * the shader mixes. Pure, no DOM and no three.
 */

export type RGB = readonly [number, number, number];

/** The four stops every shader reads (`pal(t)` runs through them). */
export type Stops = readonly [RGB, RGB, RGB, RGB];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hexPart(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const v = parseInt(h.slice(0, 6), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [clamp01(f(0)), clamp01(f(8)), clamp01(f(4))];
}

function numbers(body: string): number[] | null {
  const parts = body
    .split(/[\s,/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: number[] = [];
  for (const part of parts) {
    const pct = part.endsWith("%");
    const n = Number.parseFloat(pct ? part.slice(0, -1) : part.replace(/deg$/, ""));
    if (!Number.isFinite(n)) return null;
    out.push(pct ? n / 100 : n);
  }
  return out;
}

/**
 * A CSS colour as raw sRGB floats in 0..1: `#rgb`, `#rrggbb` (and the forms with alpha, whose alpha
 * is ignored), `rgb()` and `rgba()` (0 to 255 or percent), `hsl()` and `hsla()`. Anything else gives
 * null, and the caller keeps its default.
 */
export function parseColor(input: string): RGB | null {
  const text = input.trim().toLowerCase();
  if (text.startsWith("#")) return hexPart(text);
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(text);
  if (!fn) return null;
  const nums = numbers(fn[2]!);
  if (!nums || nums.length < 3) return null;
  if (fn[1]!.startsWith("rgb")) {
    const raw = fn[2]!.split(/[\s,/]+/).filter(Boolean);
    const scale = (i: number): number => {
      const isPct = (raw[i] ?? "").endsWith("%");
      return clamp01(isPct ? nums[i]! : nums[i]! / 255);
    };
    return [scale(0), scale(1), scale(2)];
  }
  return hslToRgb(nums[0]!, clamp01(nums[1]!), clamp01(nums[2]!));
}

/**
 * Parse a list of CSS colours. An entry that does not parse is skipped. When none is left (or the
 * list is missing) `fallback` is used, so a typo never leaves a shader with no colours. At most four
 * are kept.
 */
export function parseColors(list: readonly string[] | undefined, fallback: readonly RGB[]): RGB[] {
  const out: RGB[] = [];
  for (const item of list ?? []) {
    const c = parseColor(item);
    if (c) out.push(c);
    if (out.length === 4) break;
  }
  return out.length > 0 ? out : fallback.slice(0, 4);
}

/**
 * Four stops from one to four colours. One colour is a flat ramp, two alternate, three end by going
 * back through the middle one, four are used as given.
 */
export function fillStops(colors: readonly RGB[]): Stops {
  const a = colors[0] ?? [0, 0, 0];
  const b = colors[1] ?? a;
  const c = colors[2] ?? (colors.length === 2 ? a : b);
  const d = colors[3] ?? (colors.length === 3 ? b : colors.length === 2 ? b : c);
  return [a, b, c, d];
}

/** Compare two lists of CSS colours without allocating (the sections pass one every frame). */
export function sameColors(a: readonly string[] | undefined, b: readonly string[] | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
