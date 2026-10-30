import type { Slug } from "@/content/types";

import { FIRST, type Params, resolve, type ResolvedBeat, REST } from "./script";
import { BURST } from "./script-burst";

/**
 * The whole intro as a function of time. `sceneAt(t)` says what every layer is doing at `t`
 * seconds, with no side effects, so any frame can be drawn on its own (`?introT=` and the tests
 * do) and the renderer is only a reader of this file.
 *
 * Every time below is read off the owner's recording (`transitions.mov`, 60 fps); the table in
 * `docs/design/roster-intro.md` is the summary and the recording is the truth. To retime a layer
 * change its row here. The panels have their own beats in `script.ts`.
 */

/** The picture is black until this moment, then a hard cut to the page, with the first panel's blue plate already on it. */
export const T_BLACK = 0.7;
/** The red wedge grows in from the left. */
const T_WEDGE = 2.29;
/** The pink spear tip and the speed lines (a hard cut). */
const T_BEAM = 2.8;
/** The held beam on dark maroon (a hard cut). */
const T_HOLD = 2.883;
/** The white flash starts and ends. The page is under the picture after it. */
export const T_FLASH = 3.157;
export const T_PAGE = 3.257;
/** The thin beam, the fire and the arcs run over the page until here. */
const T_OVERLAY_END = 4.2;
/** The intro is over and the canvas is removed. */
export const DURATION = 4.7;
/** The logo block of the page comes in at this time (the page starts its own transition). */
const T_DONE = 4.2;

/** Panel names in the order the script lists them. */

interface PanelScene extends Params {
  slug: Slug;
  /** On screen at all. */
  on: boolean;
  /** The clip time to show, in seconds, held to the step of the beat. */
  clipT: number;
  /** A whole number that changes when the clip picture has to be taken again. */
  frame: number;
}

export type BeamKind = 0 | 1 | 2 | 3;
/** none, the pink spear (tip to the left), the held leaf, the blue leaf. */
export const BEAM = { none: 0, pink: 1, hold: 2, blue: 3 } as const;

export interface Scene {
  t: number;
  /** The picture under everything: 0 black, 1 the page grey, 2 dark maroon, 3 white. */
  ground: 0 | 1 | 2 | 3;
  /** 0 the canvas has a picture, 1 the canvas shows the page under it (after the flash). */
  clear: number;
  /** Panels move across by this many board units (the camera pans toward the start). */
  shift: number;
  /** The whole lineup of panels fades to this (the ghost behind the held beam). */
  lineup: number;
  /** The lineup drawn as pink line art on white (the ghost in the flash). */
  lineart: number;
  panels: PanelScene[];
  wedge: { on: boolean; edge: number; step: number };
  /** The burst of thin lines round the tip of the pink spear, redrawn on every step. */
  speed: { on: boolean; step: number; x: number; y: number; rot: number; size: number };
  /** A pale pink wash over the panels (the frame before the held beam). */
  wash: number;
  /** `x` and `y` are where the point of the shape is, as fractions of the screen. */
  beam: { kind: BeamKind; x: number; y: number; size: number; alpha: number };
  /** The thin line that crosses the left half at the end (drawn in code). */
  thin: { on: boolean; x: number; y: number; base: number; phase: number; alpha: number };
  flash: number;
  /** Over the page: the red slash flashing, the fire, the black arcs. */
  slash: number;
  fire: { on: boolean; frame: number; alpha: number };
  arcs: number;
  /** A dark red veil over Obsidia's panel, lifted while the fire burns (her splash is revealed). */
  veil: number;
  /** The page below: hidden or shown (the logo block fades in at the end). */
  page: "play" | "done";
}

const SCRIPT = [FIRST, ...BURST];

export const PANEL_SLUGS: readonly Slug[] = SCRIPT.map((s) => s.slug);

const SCRIPTS: Array<{ slug: Slug; beats: ResolvedBeat[] }> = SCRIPT.map((s) => ({
  slug: s.slug,
  beats: resolve(s.beats),
}));

export function createScene(): Scene {
  return {
    t: 0,
    ground: 0,
    clear: 0,
    shift: 0,
    lineup: 1,
    lineart: 0,
    panels: SCRIPTS.map((s) => ({ ...REST, slug: s.slug, on: false, clipT: 0, frame: 0 })),
    wedge: { on: false, edge: 0, step: 0 },
    speed: { on: false, step: 0, x: 0.47, y: 0.51, rot: 0, size: 1 },
    wash: 0,
    beam: { kind: 0, x: 0.5, y: 0.5, size: 1, alpha: 1 },
    thin: { on: false, x: 0.5, y: 0.5, base: 0.5, phase: 0, alpha: 1 },
    flash: 0,
    slash: 0,
    fire: { on: false, frame: 0, alpha: 0 },
    arcs: 0,
    veil: 0,
    page: "play",
  };
}

// ---- helpers -----------------------------------------------------------------------------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

type Key = readonly [t: number, v: number];

/** A piecewise linear track. */
function linear(keys: readonly Key[], t: number): number {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!;
    if (t <= b[0]) {
      const a = keys[i - 1]!;
      return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
  }
  return last[1];
}

/** A track that holds each value until the next key (the recording is cut on twos and threes). */
function steps(keys: readonly Key[], t: number): number {
  let v = keys[0]?.[1] ?? 0;
  for (const k of keys) {
    if (t >= k[0]) v = k[1];
    else break;
  }
  return v;
}

/** A smooth monotone curve through the keys, so the pan eases and never overshoots. */
function smooth(keys: readonly Key[], t: number): number {
  const n = keys.length;
  const first = keys[0];
  const last = keys[n - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  let i = 1;
  while (i < n - 1 && t > keys[i]![0]) i++;
  const a = keys[i - 1]!;
  const b = keys[i]!;
  const h = b[0] - a[0];
  const slope = (j: number) => {
    const p = keys[j - 1]!;
    const q = keys[j]!;
    return (q[1] - p[1]) / (q[0] - p[0]);
  };
  const dSecant = slope(i);
  const tangent = (j: number): number => {
    if (j === 0) return slope(1);
    if (j === n - 1) return slope(n - 1);
    const s0 = slope(j);
    const s1 = slope(j + 1);
    return s0 * s1 <= 0 ? 0 : (s0 + s1) / 2;
  };
  let m0 = tangent(i - 1);
  let m1 = tangent(i);
  // Fritsch and Carlson: keep the tangents from overshooting the secant.
  if (dSecant === 0) {
    m0 = 0;
    m1 = 0;
  } else {
    const a0 = m0 / dSecant;
    const b0 = m1 / dSecant;
    const s = a0 * a0 + b0 * b0;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m0 *= k;
      m1 *= k;
    }
  }
  const u = (t - a[0]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * a[1] +
    (u3 - 2 * u2 + u) * h * m0 +
    (-2 * u3 + 3 * u2) * b[1] +
    (u3 - u2) * h * m1
  );
}

/**
 * How far the board has been moved across, in board units, as the panels arrive. The camera starts
 * at the far end of the row (the first panel is at the right) and pans toward the start, slowly,
 * then fast while the burst lands, then it stops.
 */
const SHIFT_KEYS: readonly Key[] = [
  [0.68, 0],
  [1.25, 0],
  [1.6, 40],
  [2.2, 300],
  [2.6, 560],
  [2.85, 650],
  [3.3, 670],
];

// ---- the panels --------------------------------------------------------------------------

const KEYS = Object.keys(REST) as Array<keyof Params>;

function evalPanel(beats: readonly ResolvedBeat[], t: number, out: PanelScene): void {
  const first = beats[0];
  if (!first || t < first.t) {
    for (const k of KEYS) out[k] = REST[k];
    out.on = false;
    out.grow = 0;
    out.clipT = 0;
    out.frame = 0;
    return;
  }
  let i = 0;
  while (i + 1 < beats.length && t >= beats[i + 1]!.t) i++;
  const b = beats[i]!;
  const next = beats[i + 1];
  out.on = true;
  let u = 0;
  if (b.lerp && next) u = clamp01((t - b.t) / (next.t - b.t));
  for (const k of KEYS) {
    if (k === "clip") continue;
    out[k] = u > 0 && next ? lerp(b[k], next[k], u) : b[k];
  }
  const q = Math.floor((t - b.t) * b.step) / b.step;
  out.clipT = b.clip + b.rate * q;
  out.frame = Math.round(out.clipT * 1000) + i * 100000;
}

// ---- the scene ---------------------------------------------------------------------------

/**
 * Fill `out` (made by `createScene`) for time `t`. It allocates nothing, so it can run every frame.
 */
export function sceneAt(t: number, out: Scene = createScene()): Scene {
  out.t = t;

  // The ground: black, then the page's grey, then the maroon behind the held beam, then white.
  out.ground = t < T_BLACK ? 0 : t < T_HOLD ? 1 : t < T_FLASH ? 2 : 3;
  out.clear = t >= T_PAGE ? 1 : 0;
  out.shift = smooth(SHIFT_KEYS, t);

  for (let i = 0; i < SCRIPTS.length; i++) {
    const s = SCRIPTS[i] as { slug: Slug; beats: ResolvedBeat[] };
    evalPanel(s.beats, t, out.panels[i]!);
  }

  // The lineup: whole until the held beam, then a faint ghost, then line art in the flash.
  out.lineup = steps(
    [
      [0, 1],
      [2.867, 0.55],
      [T_HOLD, 0.1],
      [T_FLASH, 0.9],
      [T_FLASH + 0.035, 0.9],
      [T_FLASH + 0.07, 0],
    ],
    t,
  );
  out.lineart = t >= T_FLASH && t < T_FLASH + 0.07 ? 1 : 0;
  out.wash = t >= 2.867 && t < T_HOLD ? 0.5 : 0;

  // The red wedge from the left edge: its edge crosses the picture, then it is gone.
  const wedgeEdge = linear(
    [
      [T_WEDGE, 0.12],
      [2.33, 0.16],
      [2.4, 0.231],
      [2.47, 0.34],
      [2.53, 0.44],
      [2.6, 0.51],
      [2.67, 0.6],
      [2.7, 0.62],
      [2.8, 0.63],
    ],
    t,
  );
  out.wedge.on = t >= T_WEDGE && t < T_HOLD;
  out.wedge.edge = wedgeEdge;
  out.wedge.step = Math.floor(t * 30);

  // The speed lines come with the pink spear. They are redrawn every second frame, turned.
  const burst = t >= T_BEAM && t < 2.867;
  const stepNo = Math.floor(t * 30);
  out.speed.on = burst;
  out.speed.step = stepNo;
  out.speed.x = 0.47;
  out.speed.y = 0.51;
  out.speed.rot = ((stepNo * 2.399) % 6.2832) * 0.5;
  out.speed.size = 0.85 + 0.12 * ((stepNo * 7) % 3);

  // The beam: the pink spear (tip to the left), the held leaf, the blue leaf.
  const beam = out.beam;
  beam.alpha = 1;
  beam.size = 1;
  if (burst) {
    beam.kind = BEAM.pink;
    beam.x = steps(
      [
        [T_BEAM, 0.486],
        [2.817, 0.5],
        [2.85, 0.493],
      ],
      t,
    );
    beam.y = 0.515;
  } else if (t >= 2.867 && t < T_FLASH) {
    beam.kind = BEAM.hold;
    beam.x = steps(
      [
        [2.867, 0.54],
        [T_HOLD + 0.02, 0.526],
        [3.0, 0.527],
        [3.1, 0.528],
      ],
      t,
    );
    beam.y = steps(
      [
        [2.867, 0.53],
        [T_HOLD + 0.02, 0.51],
        [3.0, 0.512],
      ],
      t,
    );
  } else if (t >= T_FLASH && t < 3.45) {
    beam.kind = BEAM.blue;
    beam.x = 0.512;
    beam.y = steps(
      [
        [T_FLASH, 0.5],
        [T_PAGE, 0.525],
      ],
      t,
    );
  } else {
    beam.kind = BEAM.none;
    beam.x = 0.5;
    beam.y = 0.5;
  }

  // The thin line: pink, then yellow, then a cyan point, pointing at the fire in Obsidia's panel.
  out.thin.on = t >= 3.45 && t < T_OVERLAY_END;
  out.thin.x = 0.51;
  out.thin.y = 0.52;
  out.thin.base = linear(
    [
      [3.45, 0.43],
      [3.6, 0.44],
    ],
    t,
  );
  out.thin.phase = linear(
    [
      [3.45, 0],
      [3.6, 0.5],
      [3.7, 1],
    ],
    t,
  );
  out.thin.alpha = linear(
    [
      [3.45, 1],
      [3.95, 1],
      [T_OVERLAY_END, 0],
    ],
    t,
  );

  // The flash: a hard cut to white for six frames, then the page.
  out.flash = t >= T_FLASH && t < T_PAGE ? 1 : 0;

  // The layers over the page.
  out.slash =
    t >= T_PAGE && t < 3.55
      ? steps(
          [
            [T_PAGE, 1],
            [3.4, 0.7],
            [3.5, 0.4],
          ],
          t,
        )
      : 0;
  out.arcs =
    t >= 3.5 && t < T_OVERLAY_END
      ? linear(
          [
            [3.5, 1],
            [3.95, 1],
            [T_OVERLAY_END, 0],
          ],
          t,
        )
      : 0;
  out.veil =
    t >= T_PAGE && t < 4.0
      ? linear(
          [
            [T_PAGE, 0.93],
            [3.45, 0.9],
            [3.65, 0.8],
            [3.8, 0.45],
            [3.95, 0.1],
            [4.0, 0],
          ],
          t,
        )
      : 0;
  out.fire.on = t >= 3.45 && t < 3.95;
  out.fire.frame = Math.floor(t * 20);
  out.fire.alpha = linear(
    [
      [3.45, 0],
      [3.5, 0.9],
      [3.62, 1],
      [3.78, 0.55],
      [3.95, 0],
    ],
    t,
  );

  out.page = t >= T_DONE ? "done" : "play";
  return out;
}
