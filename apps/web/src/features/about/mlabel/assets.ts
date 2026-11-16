/**
 * Made by `scripts/about/mlabel/build.py` from the owner's logo picture and the official films.
 * Never edit it: change the script and run it.
 */

/** TheMLabel's logo, trimmed, on a clear ground. */
export const LOGO = {
  src: "/img/about/mlabel/logo.webp",
  width: 1329,
  height: 348,
} as const;

/** The nine letters inside the logo, as fractions of the picture, in reading order. */
export const LETTERS = [
  {
    id: "t",
    x: 0.00451,
    y: 0.02011,
    w: 0.10459,
    h: 0.8592,
  },
  {
    id: "h",
    x: 0.11889,
    y: 0.02011,
    w: 0.08503,
    h: 0.81609,
  },
  {
    id: "e",
    x: 0.21595,
    y: 0.02011,
    w: 0.07148,
    h: 0.79598,
  },
  {
    id: "m",
    x: 0.30549,
    y: 0.01724,
    w: 0.23702,
    h: 0.92529,
  },
  {
    id: "l",
    x: 0.56283,
    y: 0.02011,
    w: 0.05944,
    h: 0.9569,
  },
  {
    id: "a",
    x: 0.62904,
    y: 0.02011,
    w: 0.10986,
    h: 0.96264,
  },
  {
    id: "b",
    x: 0.74567,
    y: 0.02011,
    w: 0.07976,
    h: 0.95402,
  },
  {
    id: "e2",
    x: 0.83672,
    y: 0.02011,
    w: 0.07675,
    h: 0.92241,
  },
  {
    id: "l2",
    x: 0.9225,
    y: 0.01724,
    w: 0.07299,
    h: 0.86494,
  },
] as const;

/**
 * The logo's orange, read from the middle of its M (the stylesheet's `--orange` is this value).
 * @public
 */
export const LOGO_ORANGE = "#f14c02";

/** The M's box: its width over its height. */
export const M_ASPECT = 1.1014;

/**
 * The M, made symmetric: twelve points in its own box (0 to 1), clockwise from the top left.
 * The window in the black, the plates and the last plate all use it.
 */
export const M_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.3143, 0],
  [0.5, 0.3649],
  [0.6857, 0],
  [1, 0],
  [1, 1],
  [0.7127, 1],
  [0.7127, 0.6014],
  [0.5, 1],
  [0.2873, 0.6014],
  [0.2873, 1],
  [0, 1],
];

/** The band of the M that is solid from side to side (between the notch and the legs' gaps). */
export const M_SOLID = { top: 0.3649, bottom: 0.6014 } as const;

/**
 * The corners of the logo's own M inside the logo picture (fractions of it): top left, top
 * right, bottom right, bottom left. The last plate is laid on them.
 */
export const M_QUAD: ReadonlyArray<readonly [number, number]> = [
  [0.30549, 0.02011],
  [0.54251, 0.02011],
  [0.54251, 0.93966],
  [0.30549, 0.84195],
];

export interface PlateClip {
  readonly src: string;
  readonly still: string;
  readonly bytes: number;
  readonly seconds: number;
  /** What the stretch shows and the film it is cut from. */
  readonly what: string;
}

/** The plates in the order they flip up, by their colour. */
export const PLATE_ORDER = ["white", "pink", "gold", "red", "orange"] as const;

export type PlateTone = (typeof PLATE_ORDER)[number];

/** The clips a plate can show. One is picked a visit. */
export const PLATE_CLIPS: Record<PlateTone, readonly PlateClip[]> = {
  white: [
    {
      src: "/video/about/mlabel/white-1.mp4",
      still: "/video/about/mlabel/white-1.webp",
      bytes: 139320,
      seconds: 1.8,
      what: "Fanny in the white corridor (layla-fanny)",
    },
    {
      src: "/video/about/mlabel/white-2.mp4",
      still: "/video/about/mlabel/white-2.webp",
      bytes: 114467,
      seconds: 1.8,
      what: "the laboratory in the light (lesley-change)",
    },
    {
      src: "/video/about/mlabel/white-3.mp4",
      still: "/video/about/mlabel/white-3.webp",
      bytes: 181612,
      seconds: 1.8,
      what: "Angela waking in the white light (ruby-angela)",
    },
  ],
  pink: [
    {
      src: "/video/about/mlabel/pink-1.mp4",
      still: "/video/about/mlabel/pink-1.webp",
      bytes: 229016,
      seconds: 1.8,
      what: "the wings of pink light (selena-obsidia)",
    },
    {
      src: "/video/about/mlabel/pink-2.mp4",
      still: "/video/about/mlabel/pink-2.webp",
      bytes: 117006,
      seconds: 1.8,
      what: "Angela, close (ruby-angela)",
    },
    {
      src: "/video/about/mlabel/pink-3.mp4",
      still: "/video/about/mlabel/pink-3.webp",
      bytes: 152179,
      seconds: 1.8,
      what: "the violet storm (connection-lost)",
    },
  ],
  gold: [
    {
      src: "/video/about/mlabel/gold-1.mp4",
      still: "/video/about/mlabel/gold-1.webp",
      bytes: 168329,
      seconds: 1.8,
      what: "the city in the gold blast (lesley-change)",
    },
    {
      src: "/video/about/mlabel/gold-2.mp4",
      still: "/video/about/mlabel/gold-2.webp",
      bytes: 137579,
      seconds: 1.8,
      what: "the city at sunset (layla-fanny)",
    },
    {
      src: "/video/about/mlabel/gold-3.mp4",
      still: "/video/about/mlabel/gold-3.webp",
      bytes: 160012,
      seconds: 1.7,
      what: "the hand in the golden fire (selena-obsidia)",
    },
  ],
  red: [
    {
      src: "/video/about/mlabel/red-1.mp4",
      still: "/video/about/mlabel/red-1.webp",
      bytes: 118432,
      seconds: 1.8,
      what: "the red sky (selena-obsidia)",
    },
    {
      src: "/video/about/mlabel/red-2.mp4",
      still: "/video/about/mlabel/red-2.webp",
      bytes: 184231,
      seconds: 1.8,
      what: "Ruby with her scythe (ruby-angela)",
    },
    {
      src: "/video/about/mlabel/red-3.mp4",
      still: "/video/about/mlabel/red-3.webp",
      bytes: 303631,
      seconds: 1.8,
      what: "the burst of red light (selena-obsidia)",
    },
  ],
  orange: [
    {
      src: "/video/about/mlabel/orange-1.mp4",
      still: "/video/about/mlabel/orange-1.webp",
      bytes: 211257,
      seconds: 2.6,
      what: "Ruby, close (ruby-angela)",
    },
    {
      src: "/video/about/mlabel/orange-2.mp4",
      still: "/video/about/mlabel/orange-2.webp",
      bytes: 228930,
      seconds: 2.6,
      what: "Fanny at sunset (layla-fanny)",
    },
    {
      src: "/video/about/mlabel/orange-3.mp4",
      still: "/video/about/mlabel/orange-3.webp",
      bytes: 216999,
      seconds: 2.6,
      what: "Ruby at sunset (ruby-angela)",
    },
  ],
};
