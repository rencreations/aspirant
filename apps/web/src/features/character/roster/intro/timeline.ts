import type { Slug } from "@/content/types";

import { FIRST, type Params, resolve, type ResolvedBeat, REST } from "./script";
import { BURST } from "./script-burst";

/**
 * The whole intro as a function of time. `sceneAt(t)` says what every layer is doing at `t`
 * seconds, with no side effects, so any frame can be drawn on its own (`?introT=` and the tests
 * do) and the renderer is only a reader of this file.
 *
 * Up to 2.8 s every time is read off the owner's recording (`transitions.mov`, 60 fps). From 2.8 s
 * the ending is our own: a charge, an impact frame, a boom and the reveal of Obsidia (see
 * `docs/design/roster-intro-engine.md`). To retime a layer change its row here. The panels have
 * their own beats in `script.ts` and `script-burst.ts`.
 */

/** The picture is black until this moment, then a hard cut to the page, with the first panel's blue plate already on it. */
export const T_BLACK = 0.7;
/** The red wedge grows in from the left. */
const T_WEDGE = 2.29;
/** The charge: thin lines are drawn in toward the impact point. */
const T_CHARGE = 2.8;
/** A hard cut to dark maroon. A seed of white light grows at the impact point. */
const T_DARK = 2.883;
/** The impact frames: Obsidia as a black silhouette, five stepped pictures with shake. */
const T_HIT = 3.0;
/** The white flash, with the seams of the glass showing in it. */
export const T_FLASH = 3.157;
/** The boom: the glass breaks, the ring, the fire and the embers leave the impact point. */
export const T_BOOM = 3.2;
/** The glass has fallen away. */
const T_CLEAR = 3.85;
/** The intro is over and the canvas is removed. */
export const DURATION = 4.3;
/** The logo block of the page comes in at this time (the page starts its own transition). */
const T_DONE = 4.2;

interface PanelScene extends Params {
  slug: Slug;
  /** On screen at all. */
  on: boolean;
  /** The clip time to show, in seconds, held to the step of the beat. */
  clipT: number;
  /** A whole number that changes when the clip picture has to be taken again. */
  frame: number;
}

export interface Scene {
  t: number;
  /** The picture under everything: 0 black, 1 the page grey, 2 dark maroon, 3 white. */
  ground: 0 | 1 | 2 | 3;
  /** 0 the canvas has a picture, 1 the canvas shows the page under it (after the flash). */
  clear: number;
  /** Panels move across by this many board units (the camera pans toward the start). */
  shift: number;
  /** The whole lineup of panels fades to this (the ghost behind the charge). */
  lineup: number;
  panels: PanelScene[];
  wedge: { on: boolean; edge: number; step: number };
  /** The thin lines drawn in toward the impact point, a new picture on every step. */
  speed: { on: boolean; size: number; rot: number; alpha: number };
  /** A pale pink wash over the panels (the frame before the dark). */
  wash: number;
  /** A seed of white-hot light at the impact point (a fraction of the slash height), 0 is off. */
  seed: number;
  /** A crimson glow at the impact point: its strength and its size (a fraction of the height). */
  charge: { glow: number; size: number };
  /** The impact frame: Obsidia as a silhouette, full screen, shaking. */
  hit: { on: boolean; inv: number; zoom: number; shx: number; shy: number; tint: number };
  flash: number;
  /** The glass over the screen: `u` is how far it has broken (0 whole, 1 gone), `crack` the seams. */
  shatter: { on: boolean; u: number; crack: number };
  /** The boom at the impact point. `age` is in seconds, `core` a white-hot glow, the rings run 0 to 1. */
  boom: { on: boolean; age: number; core: number; ring: number; ring2: number };
  /** The slash of the page flares up (white-hot, flickering). */
  flare: number;
  fire: { on: boolean; frame: number; alpha: number; scale: number };
  /** The page recoils: a shift in pixels and a scale (applied to the page by the controller). */
  shake: { x: number; y: number; scale: number };
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
    panels: SCRIPTS.map((s) => ({ ...REST, slug: s.slug, on: false, clipT: 0, frame: 0 })),
    wedge: { on: false, edge: 0, step: 0 },
    speed: { on: false, size: 1, rot: 0, alpha: 1 },
    wash: 0,
    seed: 0,
    charge: { glow: 0, size: 0 },
    hit: { on: false, inv: 0, zoom: 1, shx: 0, shy: 0, tint: 0 },
    flash: 0,
    shatter: { on: false, u: 0, crack: 0 },
    boom: { on: false, age: 0, core: 0, ring: 0, ring2: 0 },
    flare: 0,
    fire: { on: false, frame: 0, alpha: 0, scale: 1 },
    shake: { x: 0, y: 0, scale: 1 },
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

  // The ground: black, the page's grey, dark maroon for the charge, white for the impact.
  out.ground = t < T_BLACK ? 0 : t < T_DARK ? 1 : t < T_HIT ? 2 : 3;
  out.clear = t >= T_FLASH ? 1 : 0;
  out.shift = smooth(SHIFT_KEYS, t);

  for (let i = 0; i < SCRIPTS.length; i++) {
    const s = SCRIPTS[i] as { slug: Slug; beats: ResolvedBeat[] };
    evalPanel(s.beats, t, out.panels[i]!);
  }

  // The lineup: whole, then half, then a faint ghost in the dark, then gone at the impact.
  out.lineup = steps(
    [
      [0, 1],
      [2.867, 0.55],
      [T_DARK, 0.12],
      [T_HIT, 0],
    ],
    t,
  );
  out.wash = t >= 2.867 && t < T_DARK ? 0.5 : 0;

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
  out.wedge.on = t >= T_WEDGE && t < T_DARK;
  out.wedge.edge = wedgeEdge;
  out.wedge.step = Math.floor(t * 30);

  // The charge (2.8 to 3.0). Thin lines are drawn in toward the impact point, each picture a
  // little smaller than the last. Then, in the dark, a seed of light grows there and pulses.
  const stepNo = Math.floor(t * 30);
  const charging = t >= T_CHARGE && t < T_HIT;
  out.speed.on = charging;
  out.speed.rot = ((stepNo * 2.399) % 6.2832) * 0.5;
  out.speed.size =
    t < T_DARK
      ? steps(
          [
            [T_CHARGE, 1.5],
            [2.833, 1.15],
            [2.867, 0.85],
          ],
          t,
        )
      : steps(
          [
            [T_DARK, 0.6],
            [2.95, 0.42],
            [2.983, 0.3],
          ],
          t,
        );
  out.speed.alpha =
    t < T_DARK
      ? 1
      : steps(
          [
            [T_DARK, 0.55],
            [2.95, 0.8],
            [2.983, 1],
          ],
          t,
        );
  out.seed =
    t >= T_DARK && t < T_HIT
      ? steps(
          [
            [T_DARK, 0.1],
            [2.917, 0.16],
            [2.95, 0.16],
            [2.967, 0.32],
            [2.983, 0.55],
          ],
          t,
        )
      : 0;
  out.charge.glow = charging
    ? steps(
        [
          [T_CHARGE, 0.2],
          [T_DARK, 0.35],
          [2.9, 0.6],
          [2.917, 0.35],
          [2.95, 0.75],
          [2.967, 0.45],
          [2.983, 1],
        ],
        t,
      )
    : 0;
  out.charge.size = charging
    ? linear(
        [
          [T_CHARGE, 0.15],
          [T_DARK, 0.25],
          [T_HIT, 0.6],
        ],
        t,
      )
    : 0;

  // The impact frames (3.0 to 3.157): Obsidia as a black silhouette on white, then white on black,
  // each a step of two frames at 60, each bigger than the last and thrown to another side. The
  // last two come back in crimson.
  const hit = out.hit;
  hit.on = t >= T_HIT && t < T_FLASH;
  hit.inv = steps(
    [
      [T_HIT, 0],
      [3.033, 1],
      [3.067, 0],
      [3.1, 1],
      [3.133, 0],
    ],
    t,
  );
  hit.zoom = steps(
    [
      [T_HIT, 1],
      [3.033, 1.06],
      [3.067, 1.12],
      [3.1, 1.1],
      [3.133, 1.18],
    ],
    t,
  );
  hit.shx = steps(
    [
      [T_HIT, 0],
      [3.033, -0.012],
      [3.067, 0.011],
      [3.1, -0.006],
      [3.133, 0.005],
    ],
    t,
  );
  hit.shy = steps(
    [
      [T_HIT, 0],
      [3.033, 0.008],
      [3.067, -0.009],
      [3.1, 0.004],
      [3.133, -0.003],
    ],
    t,
  );
  hit.tint = steps(
    [
      [T_HIT, 0],
      [3.1, 1],
    ],
    t,
  );

  // The flash: a hard cut to white, with the seams of the glass showing in it.
  out.flash = t >= T_FLASH && t < T_BOOM ? 1 : 0;

  // The glass breaks (3.2 to 3.85) from the impact point outward.
  out.shatter.on = t >= T_FLASH && t < T_CLEAR;
  out.shatter.u = clamp01((t - T_BOOM) / (T_CLEAR - T_BOOM));
  out.shatter.crack = t >= T_FLASH ? clamp01(0.5 + (t - T_FLASH) * 10) : 0;

  // The boom.
  const age = t - T_BOOM;
  out.boom.on = age >= 0 && age < 1.0;
  out.boom.age = age;
  out.boom.core =
    age < 0
      ? 0
      : linear(
          [
            [0, 1],
            [0.12, 1],
            [0.45, 0],
          ],
          age,
        );
  out.boom.ring = age < 0 ? 0 : clamp01(age / 0.75);
  out.boom.ring2 = age < 0.08 ? 0 : clamp01((age - 0.08) / 0.8);

  // The slash of the page flares up and flickers while the glass falls.
  out.flare =
    age < 0
      ? 0
      : steps(
          [
            [0, 1],
            [0.033, 0.35],
            [0.067, 1],
            [0.1, 0.5],
            [0.15, 0.85],
            [0.2, 0.3],
            [0.27, 0.6],
            [0.33, 0.15],
            [0.42, 0.3],
            [0.5, 0],
          ],
          age,
        );

  // The fire: it opens fast from the impact point, burns, then thins out. Twenty pictures a second.
  out.fire.on = age >= 0 && age < 0.85;
  out.fire.frame = Math.floor(t * 20);
  out.fire.scale = age < 0 ? 0.3 : 0.3 + 0.95 * (1 - Math.pow(1 - clamp01(age / 0.32), 3));
  out.fire.alpha =
    age < 0
      ? 0
      : linear(
          [
            [0, 1],
            [0.35, 1],
            [0.6, 0.6],
            [0.85, 0],
          ],
          age,
        );

  // The page recoils and settles: thrown about at 30 pictures a second, smaller each time.
  const amp = age < 0 || age > 0.6 ? 0 : Math.pow(1 - age / 0.6, 2);
  const n = Math.floor(t * 30);
  out.shake.x = amp * 16 * Math.cos(n * 2.399);
  out.shake.y = amp * 11 * Math.sin(n * 3.711);
  out.shake.scale = 1 + amp * 0.012;

  out.page = t >= T_DONE ? "done" : "play";
  return out;
}
