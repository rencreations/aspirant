import { mulberry32 } from "@/lib/math";

/**
 * Frame shapes for <Frame>. Every vertex is `[xPercent, xPx, yPercent, yPx]`, which maps to
 * `calc(x% + xpx) calc(y% + ypx)` in CSS. Pixel offsets keep chamfers, notches and torn edges
 * the same size at any frame size; percentages carry the overall silhouette.
 */
export type FrameShape =
  | "chamfer"
  | "hex"
  | "star"
  | "arch"
  | "parallelogram"
  | "rift"
  | "bite"
  | "ticket"
  | "circle"
  | "emblem";

/** One vertex: x percent, x pixel offset, y percent, y pixel offset. @public */
export type FrameVertex = readonly [number, number, number, number];

/** All shape names, in display order. */
export const FRAME_SHAPE_NAMES: readonly FrameShape[] = [
  "chamfer",
  "hex",
  "star",
  "arch",
  "parallelogram",
  "rift",
  "bite",
  "ticket",
  "circle",
  "emblem",
];

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function pct(x: number, y: number): FrameVertex {
  return [r3(x), 0, r3(y), 0];
}

/** Chamfered panel: top-left and bottom-right corners cut by 18 px. */
function chamfer(cut = 18): FrameVertex[] {
  return [
    [0, cut, 0, 0],
    [100, 0, 0, 0],
    [100, 0, 100, -cut],
    [100, -cut, 100, 0],
    [0, 0, 100, 0],
    [0, 0, 0, cut],
  ];
}

/** Pointy-top hexagon (the Defence Sphere tile). Best near a 0.87 aspect ratio. */
function hex(): FrameVertex[] {
  return [pct(50, 0), pct(100, 25), pct(100, 75), pct(50, 100), pct(0, 75), pct(0, 25)];
}

/** Quadratic Bezier sample helper in px space. */
function quad(
  a: readonly [number, number],
  c: readonly [number, number],
  b: readonly [number, number],
  steps: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
    ]);
  }
  return out;
}

/** Panel with four chamfered corners and a four-pointed-star notch cut into the top edge. */
function star(cut = 12, half = 26, depth = 22): FrameVertex[] {
  const pts: FrameVertex[] = [[0, cut, 0, 0]];
  // Notch: the lower point of an Emblem star, sides curving toward its centre.
  const left = quad([-half, 0], [-half * 0.14, depth * 0.14], [0, depth], 6);
  const right = quad([0, depth], [half * 0.14, depth * 0.14], [half, 0], 6).slice(1);
  for (const [x, y] of [...left, ...right]) pts.push([50, r3(x), 0, r3(y)]);
  pts.push(
    [100, -cut, 0, 0],
    [100, 0, 0, cut],
    [100, 0, 100, -cut],
    [100, -cut, 100, 0],
    [0, cut, 100, 0],
    [0, 0, 100, -cut],
    [0, 0, 0, cut],
  );
  return pts;
}

/** Arch: a rounded top over straight sides. The arch takes the top 32 percent. */
function arch(rise = 32, steps = 28): FrameVertex[] {
  const pts: FrameVertex[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI - (i / steps) * Math.PI;
    pts.push(pct(50 + 50 * Math.cos(t), rise - rise * Math.sin(t)));
  }
  pts.push(pct(100, 100), pct(0, 100));
  return pts;
}

/** Parallelogram slanted by 10 percent of the width. */
function parallelogram(slant = 10): FrameVertex[] {
  return [pct(slant, 0), pct(100, 0), pct(100 - slant, 100), pct(0, 100)];
}

/** Torn rift: jagged left and right edges (deterministic), the right side torn deeper. */
function rift(seed = 7): FrameVertex[] {
  const rand = mulberry32(seed);
  const pts: FrameVertex[] = [
    [0, 0, 0, 0],
    [100, 0, 0, 0],
  ];
  const teeth = 18;
  for (let i = 1; i < teeth; i++) {
    const y = (i / teeth) * 100 + (rand() - 0.5) * 3;
    const depth = i % 2 ? 6 + rand() * 20 : rand() * 6;
    pts.push([100, -r3(depth), r3(y), 0]);
  }
  pts.push([100, 0, 100, 0], [0, 0, 100, 0]);
  for (let i = teeth - 1; i >= 1; i--) {
    const y = (i / teeth) * 100 + (rand() - 0.5) * 3;
    const depth = i % 2 ? 3 + rand() * 9 : rand() * 3;
    pts.push([0, r3(depth), r3(y), 0]);
  }
  return pts;
}

/** Circle (ellipse when the frame is not square). */
function circle(steps = 64): FrameVertex[] {
  const pts: FrameVertex[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2 - Math.PI / 2;
    pts.push(pct(50 + 50 * Math.cos(t), 50 + 50 * Math.sin(t)));
  }
  return pts;
}

/** Circle with a round bite taken out of the top right. Computed numerically. */
function bite(): FrameVertex[] {
  const R = 50;
  const cx = 50;
  const cy = 50;
  const angle = -Math.PI / 4;
  const bx = cx + Math.cos(angle) * R * 1.02;
  const by = cy + Math.sin(angle) * R * 1.02;
  const br = 20;
  const inside = (x: number, y: number, ox: number, oy: number, r: number) =>
    (x - ox) ** 2 + (y - oy) ** 2 < r * r;

  // Main circle points outside the bite, clockwise starting just after the bite.
  const main: Array<[number, number]> = [];
  const steps = 96;
  for (let i = 0; i < steps; i++) {
    const t = angle + (i / steps) * Math.PI * 2;
    const x = cx + R * Math.cos(t);
    const y = cy + R * Math.sin(t);
    if (!inside(x, y, bx, by, br)) main.push([x, y]);
  }
  // Bite arc points that fall inside the main circle (the concave edge).
  const arc: Array<[number, number]> = [];
  const arcSteps = 48;
  for (let i = 0; i < arcSteps; i++) {
    const t = (i / arcSteps) * Math.PI * 2;
    const x = bx + br * Math.cos(t);
    const y = by + br * Math.sin(t);
    if (inside(x, y, cx, cy, R)) arc.push([x, y]);
  }
  // Order the arc so it runs from the last main point back to the first.
  // Sort by angle relative to the direction of the main centre, so the arc never straddles
  // the atan2 seam.
  const toCentre = Math.atan2(cy - by, cx - bx);
  const rel = (p: readonly [number, number]) => {
    let d = Math.atan2(p[1] - by, p[0] - bx) - toCentre;
    while (d <= -Math.PI) d += Math.PI * 2;
    while (d > Math.PI) d -= Math.PI * 2;
    return d;
  };
  arc.sort((a, b) => rel(a) - rel(b));
  const last = main[main.length - 1];
  const first = arc[0];
  const end = arc[arc.length - 1];
  if (last && first && end) {
    const d0 = (first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2;
    const d1 = (end[0] - last[0]) ** 2 + (end[1] - last[1]) ** 2;
    if (d1 < d0) arc.reverse();
  }
  return [...main, ...arc].map(([x, y]) => pct(x, y));
}

/** Ticket stub: semicircle notches (14 px) on both sides at mid height, small corner cuts. */
function ticket(notch = 14, cut = 6, steps = 10): FrameVertex[] {
  const pts: FrameVertex[] = [
    [0, cut, 0, 0],
    [100, -cut, 0, 0],
    [100, 0, 0, cut],
  ];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([100, r3(-notch * Math.cos(t)), 50, r3(notch * Math.sin(t))]);
  }
  pts.push([100, 0, 100, -cut], [100, -cut, 100, 0], [0, cut, 100, 0], [0, 0, 100, -cut]);
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI / 2 - (i / steps) * Math.PI;
    pts.push([0, r3(notch * Math.cos(t)), 50, r3(notch * Math.sin(t))]);
  }
  pts.push([0, 0, 0, cut]);
  return pts;
}

/** Fat four-pointed star with concave sides (the Emblem of Hope), for avatars. */
function emblem(waist = 17, steps = 10): FrameVertex[] {
  const tips: Array<[number, number]> = [
    [50, 0],
    [100, 50],
    [50, 100],
    [0, 50],
  ];
  const ctrls: Array<[number, number]> = [
    [50 + waist, 50 - waist],
    [50 + waist, 50 + waist],
    [50 - waist, 50 + waist],
    [50 - waist, 50 - waist],
  ];
  const pts: FrameVertex[] = [];
  for (let s = 0; s < 4; s++) {
    const a = tips[s] ?? [50, 0];
    const b = tips[(s + 1) % 4] ?? [50, 0];
    const c = ctrls[s] ?? [50, 50];
    for (const [x, y] of quad(a, c, b, steps).slice(0, -1)) pts.push(pct(x, y));
  }
  return pts;
}

/** Point data for every shape. @public */
export const FRAME_SHAPES: Readonly<Record<FrameShape, readonly FrameVertex[]>> = {
  chamfer: chamfer(),
  hex: hex(),
  star: star(),
  arch: arch(),
  parallelogram: parallelogram(),
  rift: rift(),
  bite: bite(),
  ticket: ticket(),
  circle: circle(),
  emblem: emblem(),
};

function coord(p: number, o: number): string {
  if (o === 0) return `${p}%`;
  if (p === 0) return `${o}px`;
  return `calc(${p}% ${o < 0 ? "-" : "+"} ${Math.abs(o)}px)`;
}

function toClipPath(vertices: readonly FrameVertex[]): string {
  return `polygon(${vertices.map(([xp, xo, yp, yo]) => `${coord(xp, xo)} ${coord(yp, yo)}`).join(", ")})`;
}

/** CSS `clip-path: polygon(...)` value for every shape. */
export const FRAME_CLIP_PATHS: Readonly<Record<FrameShape, string>> = Object.fromEntries(
  (Object.keys(FRAME_SHAPES) as FrameShape[]).map((k) => [k, toClipPath(FRAME_SHAPES[k])]),
) as Record<FrameShape, string>;

/** The shape's vertices in px for a box of `w` by `h` (for SVG outlines). @public */
export function framePoints(shape: FrameShape, w: number, h: number): Array<[number, number]> {
  return FRAME_SHAPES[shape].map(([xp, xo, yp, yo]) => [(xp / 100) * w + xo, (yp / 100) * h + yo]);
}

/** SVG path data (closed) for the shape in a `w` by `h` box. */
export function framePath(shape: FrameShape, w: number, h: number): string {
  const pts = framePoints(shape, w, h);
  return `${pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("")}Z`;
}
