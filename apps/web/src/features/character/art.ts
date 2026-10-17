/**
 * Art direction for the character pages: which palette colours lead, where the face sits in
 * each splash, which processed art exists (see docs/design/assets.md) and how each page's
 * signature effect behaves. No lore lives here, only layout and asset facts.
 */
import type { FrameShape } from "@/components/frame/frame-shapes";
import type { PairId, Slug } from "@/content/types";

import type { AccentChoice } from "./theme";

/** A processed image with its intrinsic size. `src` is a public path for asset(). */
export interface ArtImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

/** The pointer effect drawn over each hero, taken from the character's weapon or power. */
export type SignatureKind =
  | "cable"
  | "beam"
  | "scythe"
  | "shield"
  | "reticle"
  | "crescent"
  | "stars"
  | "orb"
  | "lightning"
  | "moons";

/** One of the two forms, as art (when official art exists) and a caption. */
export interface FormArt {
  readonly image: ArtImage | null;
  /** CSS object-position, to keep the figure (and never a burned-in caption) in view. */
  readonly position?: string;
  /** Where the image comes from, shown under it. */
  readonly source: string;
}

export interface ArtDirection {
  readonly accent: AccentChoice;
  /** The face in the splash, in percent (object-position and the detail lens). */
  readonly focus: { readonly x: number; readonly y: number };
  /** Transparent cut-out, or null where the source has none (Ruby, Angela, Lesley, Chang'e). */
  readonly cutout: ArtImage | null;
  /** The cut-out is the whole splash without its background, so it lines up with it. */
  readonly cutoutAligned: boolean;
  /** Frame silhouette of the roster card and the hero art. */
  readonly shape: FrameShape;
  readonly signature: SignatureKind;
  /** Short HUD caption for the signature effect, our copy. */
  readonly signatureLabel: string;
  /** Extra official art for the gallery. */
  readonly extras: readonly ArtImage[];
  /** Art for the form toggle (Vexana, Selena and Obsidia only). */
  readonly forms?: { readonly normal: FormArt; readonly ender: FormArt };
}

const SPLASH = { width: 2048, height: 1152 } as const;
const SPLASH_SM = { width: 800, height: 450 } as const;

/** The splash art of a character (2048 wide). */
export function splashOf(slug: Slug, name: string): ArtImage {
  return { src: `/img/char/${slug}/splash.webp`, ...SPLASH, alt: `${name}, official splash art` };
}

/** The small splash (800 wide), for cards and previews. */
export function splashSmOf(slug: Slug, name: string): ArtImage {
  return {
    src: `/img/char/${slug}/splash-sm.webp`,
    ...SPLASH_SM,
    alt: `${name}, official splash art`,
  };
}

function cutout(slug: Slug, name: string, width: number, height: number): ArtImage {
  return { src: `/img/char/${slug}/cutout.webp`, width, height, alt: `${name}, cut-out art` };
}

export const ART: Readonly<Record<Slug, ArtDirection>> = {
  fanny: {
    accent: { accent: "primary", accent2: "secondary" },
    focus: { x: 63, y: 30 },
    cutout: cutout("fanny", "Fanny", 3200, 1800),
    cutoutAligned: true,
    shape: "parallelogram",
    signature: "cable",
    signatureLabel: "Cable gear",
    extras: [
      {
        src: "/img/char/fanny/extra-1.webp",
        width: 1272,
        height: 1800,
        alt: "Fanny in flight, official art",
      },
    ],
  },
  layla: {
    accent: { accent: "primary", accent2: "secondary" },
    focus: { x: 60, y: 44 },
    cutout: cutout("layla", "Layla", 3200, 1800),
    cutoutAligned: true,
    shape: "chamfer",
    signature: "beam",
    signatureLabel: "Cannon",
    extras: [],
  },
  ruby: {
    accent: { accent: "secondary", accent2: "glow" },
    focus: { x: 47, y: 24 },
    cutout: null,
    cutoutAligned: false,
    shape: "ticket",
    signature: "scythe",
    signatureLabel: "Scythe",
    extras: [],
  },
  angela: {
    accent: { accent: "secondary", accent2: "glow" },
    focus: { x: 57, y: 24 },
    cutout: null,
    cutoutAligned: false,
    shape: "arch",
    signature: "shield",
    signatureLabel: "Shield",
    extras: [],
  },
  lesley: {
    accent: { accent: "primary", accent2: "glow" },
    focus: { x: 57, y: 28 },
    cutout: null,
    cutoutAligned: false,
    shape: "chamfer",
    signature: "reticle",
    signatureLabel: "Scope",
    extras: [],
  },
  change: {
    accent: { accent: "primary", accent2: "secondary" },
    focus: { x: 60, y: 28 },
    cutout: null,
    cutoutAligned: false,
    shape: "arch",
    signature: "crescent",
    signatureLabel: "Crescent Moon",
    extras: [],
  },
  guinevere: {
    accent: { accent: "secondary", accent2: "primary" },
    focus: { x: 61, y: 35 },
    cutout: cutout("guinevere", "Guinevere", 1800, 1800),
    cutoutAligned: false,
    shape: "star",
    signature: "stars",
    signatureLabel: "Star blades",
    extras: [],
  },
  vexana: {
    accent: { accent: "primary", accent2: "secondary" },
    focus: { x: 65, y: 57 },
    cutout: cutout("vexana", "Vexana", 1800, 1800),
    cutoutAligned: false,
    shape: "rift",
    signature: "orb",
    signatureLabel: "Black orb",
    extras: [
      {
        src: "/img/char/vexana/extra-1.webp",
        width: 1440,
        height: 3200,
        alt: "Vexana, official mobile wallpaper",
      },
    ],
    forms: {
      normal: {
        image: null,
        source: "No official art shows this form. The description comes from the character file.",
      },
      ender: {
        image: {
          src: "/img/char/vexana/extra-1.webp",
          width: 1440,
          height: 3200,
          alt: "Vexana with blue-lavender hair and horns, official mobile wallpaper",
        },
        position: "50% 30%",
        source: "Official mobile wallpaper. Her splash art shows this form too.",
      },
    },
  },
  obsidia: {
    accent: { accent: "primary", accent2: "secondary" },
    focus: { x: 47, y: 16 },
    cutout: cutout("obsidia", "Obsidia", 1860, 1800),
    cutoutAligned: false,
    shape: "rift",
    signature: "lightning",
    signatureLabel: "Storm",
    extras: [],
    forms: {
      normal: {
        image: cutout("obsidia", "Obsidia", 1860, 1800),
        position: "50% 30%",
        source: "Official art.",
      },
      ender: {
        image: {
          src: "/img/stills/obsidia-ender.webp",
          width: 1280,
          height: 540,
          alt: "A pale figure arched back in white and orange flame, official trailer frame",
        },
        // The frame carries a burned-in caption at the top: keep the lower part in view.
        position: "50% 100%",
        source: "Official trailer frame, 2:35.",
      },
    },
  },
  selena: {
    accent: { accent: "primary", accent2: "glow" },
    focus: { x: 68, y: 24 },
    cutout: cutout("selena", "Selena", 2593, 1800),
    cutoutAligned: false,
    shape: "parallelogram",
    signature: "moons",
    signatureLabel: "Silverbolt",
    extras: [],
    forms: {
      normal: {
        image: cutout("selena", "Selena", 2593, 1800),
        position: "50% 30%",
        source: "Official art, combat suit.",
      },
      ender: {
        image: {
          src: "/img/stills/selena-ender.webp",
          width: 1280,
          height: 540,
          alt: "A pink-haired figure with one glowing star-shaped pupil, official trailer frame",
        },
        position: "50% 40%",
        source: "Official trailer frame, 1:18.",
      },
    },
  },
};

/** Shared official art of a pair (only two pairs have any). */
export const PAIR_ART: Readonly<Record<PairId, readonly ArtImage[]>> = {
  "fanny-layla": [
    {
      src: "/img/pair/fanny-layla/fighting-together-splash-art.webp",
      width: 2048,
      height: 1152,
      alt: "Fanny and Layla fighting together, official splash art",
    },
    {
      src: "/img/pair/fanny-layla/fanny-and-layla.webp",
      width: 1000,
      height: 563,
      alt: "Fanny and Layla, official art",
    },
  ],
  "guinevere-vexana": [
    {
      src: "/img/pair/guinevere-vexana/both-splash-art.webp",
      width: 2048,
      height: 1152,
      alt: "Guinevere and Vexana, official splash art",
    },
    {
      src: "/img/pair/guinevere-vexana/fighting-moment.webp",
      width: 2048,
      height: 1152,
      alt: "Guinevere and Vexana in a fight, official art",
    },
    {
      src: "/img/pair/guinevere-vexana/fighting-stance.webp",
      width: 2048,
      height: 1152,
      alt: "Guinevere and Vexana in a fighting stance, official art",
    },
  ],
  "ruby-angela": [],
  "lesley-change": [],
  "selena-obsidia": [],
};

/** The three characters with a second form. */
export function hasForms(slug: Slug): boolean {
  return ART[slug].forms !== undefined;
}
