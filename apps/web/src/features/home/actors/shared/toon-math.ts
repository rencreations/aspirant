/**
 * The pure numbers of the toon look (see `toon.ts`): smooth normals for the ink hull, how wide the
 * ink line is for a size on the screen, and how a look is written into shader uniforms. No three.js
 * here, so it is tested in node.
 */

/**
 * One normal per place, not one per vertex: a model has hard normals on its armour and a cut at
 * every texture seam, so pushing each vertex along its own normal opens the hull. The smooth normal
 * is the average of the normals of every vertex at the same place.
 *
 * `step` welds places that differ by less than it (0 = only exactly equal values are one place).
 * Normals that cancel (a thin double sided sheet) keep the vertex's own normal.
 */
export function smoothNormals(
  /** The positions, three a vertex, as the accessor reads them (not the quantised ints). */
  positions: ArrayLike<number>,
  /** The vertex normals, three a vertex. */
  normals: ArrayLike<number>,
  step = 0,
): Float32Array {
  const count = Math.floor(positions.length / 3);
  const out = new Float32Array(count * 3);
  const slot = new Map<string, number>();
  const sums: number[] = [];
  const which = new Int32Array(count);
  const cell = (v: number): number => (step > 0 ? Math.round(v / step) : v);
  for (let i = 0; i < count; i += 1) {
    const key = `${cell(positions[i * 3]!)},${cell(positions[i * 3 + 1]!)},${cell(positions[i * 3 + 2]!)}`;
    let s = slot.get(key);
    if (s === undefined) {
      s = sums.length / 3;
      slot.set(key, s);
      sums.push(0, 0, 0);
    }
    which[i] = s;
    sums[s * 3] = (sums[s * 3] ?? 0) + normals[i * 3]!;
    sums[s * 3 + 1] = (sums[s * 3 + 1] ?? 0) + normals[i * 3 + 1]!;
    sums[s * 3 + 2] = (sums[s * 3 + 2] ?? 0) + normals[i * 3 + 2]!;
  }
  for (let i = 0; i < count; i += 1) {
    const s = which[i]! * 3;
    const x = sums[s]!;
    const y = sums[s + 1]!;
    const z = sums[s + 2]!;
    const len = Math.hypot(x, y, z);
    if (len > 1e-6) {
      out[i * 3] = x / len;
      out[i * 3 + 1] = y / len;
      out[i * 3 + 2] = z / len;
    } else {
      out[i * 3] = normals[i * 3]!;
      out[i * 3 + 1] = normals[i * 3 + 1]!;
      out[i * 3 + 2] = normals[i * 3 + 2]!;
    }
  }
  return out;
}

/** The step to weld places by for a mesh whose bounding box has this diagonal: a hundred thousandth of it. */
export function weldStep(diagonal: number): number {
  return diagonal > 0 ? diagonal * 1e-5 : 0;
}

/** Ink line numbers: a width in CSS pixels and how far the hull is pushed back (view units). */
export interface InkSize {
  px: number;
  push: number;
  /** The share of `px` that the line round an alpha card (hair) gets. */
  card: number;
}

/** The line's width in CSS pixels for a figure of `heightPx` on the screen: the one rule of the whole cast. */
const LINE = { min: 1.1, slope: 0.0029, max: 3.3, from: 120 } as const;

/**
 * The ink for a figure `heightPx` tall on the screen (CSS pixels). A small figure keeps a clear
 * line, a big one gets a little more, so the drawing keeps its weight: 1.1 px at 120 px tall (a
 * heavier line fills a figure that small with ink), 1.9 at 400, 2.5 at 600, 3.3 at 900 and never
 * more than that (`LINE`). Every actor feeds this the height of its own main figure and scales it by
 * its own `weight` (hair 0.6, and a thin share for the parts of a model that are all outline), so
 * the cast draws one weight of line. The push is a thin share of the height: it keeps
 * the hull behind the skin so a one sided card does not fight its own ink, and it is small enough
 * that a part a centimetre behind another still hides the ink of the one in front of it.
 */
export function outlineFor(heightPx: number, out: InkSize = { px: 0, push: 0, card: 0 }): InkSize {
  const h = heightPx > 0 ? heightPx : 0;
  // Hair strands are thin: a small figure gets a fine line round its cards, a big one up to 0.5.
  out.card = Math.min(0.5, 0.12 + h / 2400);
  const px = LINE.min + (h - LINE.from) * LINE.slope;
  out.px = px < LINE.min ? LINE.min : px > LINE.max ? LINE.max : px;
  out.push = Math.max(0.1, h * 0.0012);
  return out;
}

/** A colour as three numbers in 0..1 (linear). */
export type Rgb = readonly [number, number, number];

/** What a look is: every number the shader takes. Written once into uniforms, not per frame. */
export interface ToonLookSpec {
  /** Two (shade, lit) or three (deep, shade, lit) bands. */
  bands: 2 | 3;
  /** Where the bands turn, on the dot of the normal and the light: the deep step, then the lit step. */
  cut: readonly [number, number];
  /** Half width of a band edge on that dot: small is hard (about 0.03), never zero (it aliases). */
  soft: number;
  /** What the albedo is multiplied by in the shade band and in the deep band: a cool, hue shifted tint. */
  shade: Rgb;
  deep: Rgb;
  /** What the albedo is multiplied by on the lit side (1 keeps the painted colour). */
  lit: Rgb;
  /** Saturation of the shade bands: 1 keeps the tinted colour as it is, above 1 pushes it. */
  sat: number;
  /** The rim on the shadow side: strength 0..1 and width (the share of the silhouette it covers). */
  rim: number;
  rimWidth: number;
  /** A crisp highlight shape: strength 0..1 and the cosine of its half angle (0.97 is about 14 degrees). */
  glint: number;
  glintSize: number;
}

/** Merge a look with a few overrides. */
export function tuneLook(base: ToonLookSpec, tune?: Partial<ToonLookSpec>): ToonLookSpec {
  return tune ? { ...base, ...tune } : base;
}

/** A hue shifted shade for one colour, the same arithmetic the shader runs (used by the tests and the probes). */
export function shadeOf(albedo: Rgb, tint: Rgb, sat: number): [number, number, number] {
  const r = albedo[0] * tint[0];
  const g = albedo[1] * tint[1];
  const b = albedo[2] * tint[2];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [l + (r - l) * sat, l + (g - l) * sat, l + (b - l) * sat];
}

/** The weights of the bands for a dot of normal and light: [deep, shade, lit], the same as the shader. */
export function bandWeights(
  ndl: number,
  look: Pick<ToonLookSpec, "bands" | "cut" | "soft">,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const edge = (cut: number): number => {
    const t = Math.min(1, Math.max(0, (ndl - (cut - look.soft)) / (2 * look.soft)));
    return t * t * (3 - 2 * t);
  };
  const lit = edge(look.cut[1]);
  if (look.bands === 3) {
    const shade = edge(look.cut[0]);
    out[0] = (1 - shade) * (1 - lit);
    out[1] = shade * (1 - lit);
    out[2] = lit;
  } else {
    out[0] = 0;
    out[1] = 1 - lit;
    out[2] = lit;
  }
  return out;
}
