import type { CharacterSlug } from "@/lib/slugs";

import { contrast } from "./room-math";
import { SEAS, type Sea, type SeaPreset, type SlatsLook } from "./slats/look";

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
  secondary?: string;
  glow?: string;
}

/** The colours of one character's field. The tones of her palette ride along for the slats. */
export interface FieldColors {
  /** Her primary colour, deepened until white type reads on it. */
  main: string;
  /** A deeper tone of it. */
  deep: string;
  primary?: string;
  secondary?: string;
  glow?: string;
  ink?: string;
}

/**
 * The colour field behind the ring for one character, as the reference gives each item its own:
 * her primary colour deepened with her ink, as little as it takes for white type to read on it
 * (4.5 to 1), and a deeper tone of it. The tones of her palette are passed on for the slats.
 */
export function fieldColors(palette: Palette): FieldColors {
  let t = 0.4;
  let main = mixHex(palette.primary, palette.ink, t);
  while (contrast(main, "#ffffff") < 4.6 && t < 0.95) {
    t += 0.04;
    main = mixHex(palette.primary, palette.ink, t);
  }
  return {
    main,
    deep: mixHex(palette.primary, palette.ink, Math.min(0.92, t + 0.3)),
    primary: palette.primary,
    secondary: palette.secondary,
    glow: palette.glow,
    ink: palette.ink,
  };
}

type Tone = "primary" | "secondary" | "glow";

/** How one character's field is drawn: a sea, the tones of her palette, and the slats. */
interface LookSpec {
  sea: SeaPreset;
  /** Changes to the sea of the preset. */
  tune?: Partial<Sea>;
  /** The tone of the slats, deepened so white type reads over them. */
  body: Tone;
  /** The tone of the light on the crests and in the pointer's trail, at full strength. */
  light: Tone;
  /** Width, height and gap of a slat, in CSS pixels on a screen whose short side is 900. */
  slat: readonly [number, number, number];
  roundness: number;
  /** Lifts the saturation of a pale body tone (1 keeps it). */
  vivid?: number;
}

/**
 * The ten fields. The pairs share their kind of sea and differ in colour, heading and slats, so
 * the ten read as one family and no two are the same:
 *
 * - Selena and Obsidia, the swell and the tide: hers a quick sky blue sea lit violet like her
 *   lightning, Obsidia's a slow crimson tide lit by her pink glow, on tall slats.
 * - Guinevere and Vexana, the signal: Cross x Credo is a stage song, so both are an equaliser
 *   wall, hers short and wide, red with peach light, Vexana's thin and tall, violet with magenta.
 * - Lesley and Chang'e, two ends of one channel: Lesley's needle thin lines run straight at the
 *   viewer like the scale of a scope, rust with gold; Chang'e's are round dots, pink with mint.
 * - Ruby and Angela, the night shift and the first sunrise: one calm tide, navy under gold for
 *   Ruby, rose under peach for Angela, with the heading turned.
 * - Layla and Fanny, We Believe!: the storm, Layla's teal with coral light on broad slats,
 *   Fanny's purple with orange light, quick and fine.
 */
const LOOKS: Readonly<Record<CharacterSlug, LookSpec>> = {
  selena: {
    sea: "swell",
    tune: { scale: 0.95, speed: 0.75, glint: 1 },
    body: "primary",
    light: "glow",
    slat: [8, 22, 3],
    roundness: 0.75,
    vivid: 1.7,
  },
  obsidia: {
    sea: "tide",
    tune: { scale: 1.1, speed: 0.38, direction: 280, glint: 0.8 },
    body: "primary",
    light: "glow",
    slat: [10, 32, 3],
    roundness: 0.6,
  },
  guinevere: {
    sea: "signal",
    tune: { speed: 1.1, glint: 0.5 },
    body: "secondary",
    light: "primary",
    slat: [13, 15, 4],
    roundness: 0.3,
  },
  vexana: {
    sea: "signal",
    tune: { speed: 0.9, direction: 0, stretch: 0.75, glint: 0.5 },
    body: "primary",
    light: "secondary",
    slat: [6, 26, 3],
    roundness: 1,
  },
  lesley: {
    sea: "tide",
    tune: { scale: 0.9, direction: 270, chop: 0.5, glint: 0.9 },
    body: "primary",
    light: "secondary",
    slat: [3, 34, 5],
    roundness: 1,
  },
  change: {
    sea: "swell",
    tune: { scale: 0.85, speed: 0.8, direction: 228, stretch: 0.2 },
    body: "primary",
    light: "glow",
    slat: [9, 9, 5],
    roundness: 1,
    vivid: 1.35,
  },
  ruby: {
    sea: "tide",
    tune: { scale: 1, speed: 0.42, glint: 0.85 },
    body: "primary",
    light: "glow",
    slat: [10, 26, 3],
    roundness: 0.75,
  },
  angela: {
    sea: "tide",
    tune: { scale: 1, speed: 0.5, direction: 290, glint: 0.85, contrast: 1.2 },
    body: "secondary",
    light: "primary",
    slat: [10, 26, 3],
    roundness: 0.75,
  },
  layla: {
    sea: "storm",
    tune: { speed: 1.1, scale: 0.8, glint: 1 },
    body: "secondary",
    light: "primary",
    slat: [14, 30, 4],
    roundness: 0.55,
  },
  fanny: {
    sea: "storm",
    tune: { speed: 1.35, direction: 214 },
    body: "secondary",
    light: "primary",
    slat: [7, 20, 3],
    roundness: 0.9,
  },
};

/** `hex` scaled toward black by `k` (1 keeps it): the hue and the saturation stay. */
function shade(hex: string, k: number): string {
  return toHex(rgb(hex).map((v) => v * k));
}

/** `hex` with its saturation (as in HSV) times `k`, at the same brightness. */
export function saturate(hex: string, k: number): string {
  const c = rgb(hex);
  const top = Math.max(...c);
  return toHex(c.map((v) => Math.max(0, top - (top - v) * k)));
}

/**
 * A tone deepened until white type reads on it at `ratio`. It is scaled toward black, never mixed
 * with grey or with another hue, so a red stays red and a violet stays violet. Darker tones are
 * left as they are.
 */
export function deepen(tone: string, ratio = 4.6): string {
  if (contrast(tone, "#ffffff") >= ratio) return tone;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const k = (lo + hi) / 2;
    if (contrast(shade(tone, k), "#ffffff") >= ratio) lo = k;
    else hi = k;
  }
  return shade(tone, lo);
}

/** One character's field as the slats draw it. Pure: the same colours give the same look. */
export function slatsLook(slug: string, colors: FieldColors): SlatsLook {
  const spec = (LOOKS[slug as CharacterSlug] as LookSpec | undefined) ?? LOOKS.selena;
  const body = deepen(saturate(colors[spec.body] ?? colors.main, spec.vivid ?? 1));
  return {
    color: body,
    glint: colors[spec.light] ?? colors.main,
    // Her ink, warmed a little by the slats so the ground is never a flat black.
    ground: mixHex(colors.ink ?? colors.deep, body, 0.14),
    sea: { ...SEAS[spec.sea], ...spec.tune },
    slatWidth: spec.slat[0],
    slatHeight: spec.slat[1],
    gap: spec.slat[2],
    roundness: spec.roundness,
  };
}
