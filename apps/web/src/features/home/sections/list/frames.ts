/**
 * The nine pictures of the list, in the owner's order, and the tenth frame (Selena in 3D). Written
 * from `public/data/home/picks.json` (`loops`), which the media workstream makes: `frames.test.ts`
 * keeps this file equal to it. It is small on purpose, because `preload.ts` is in the bundle of
 * every page. `window` is the 4:5 part of the whole picture the frame shows (fractions); a press
 * opens the whole picture.
 */

export interface FrameWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VideoFrame {
  slug: string;
  name: string;
  kind: "video";
  /** The 4:5 still of the first frame, shown until the loop has arrived. */
  poster: string;
  posterBytes: number;
  /** The whole picture's still, for the open view before the loop is there. */
  posterFull: string;
  posterFullBytes: number;
  video: { path: string; w: number; h: number; bytes: number };
  window: FrameWindow;
  alt: string;
}

interface StillFrame {
  slug: string;
  name: string;
  kind: "still";
  poster: string;
  posterBytes: number;
  /** The library key of the whole picture (`libUrl`), 2560 by 1440. */
  full: { lib: string; w: number; h: number; bytes: number };
  window: FrameWindow;
  alt: string;
}

export type PictureFrame = VideoFrame | StillFrame;

export const PICTURE_FRAMES: readonly PictureFrame[] = [
  {
    slug: "obsidia",
    name: "Obsidia",
    kind: "video",
    poster: "/img/home/loops/obsidia-45.webp",
    posterBytes: 60716,
    posterFull: "/img/home/loops/obsidia-full.webp",
    posterFullBytes: 106574,
    video: { path: "/video/home/loops/obsidia.mp4", w: 1920, h: 864, bytes: 1926561 },
    window: { x: 0.3594, y: 0, w: 0.3599, h: 1 },
    alt: "Obsidia, in the official animation of the series, cropped to her.",
  },
  {
    slug: "fanny",
    name: "Fanny",
    kind: "still",
    poster: "/img/home/cards/fanny-45.webp",
    posterBytes: 120688,
    full: {
      lib: "arts/v2/splash/arts-splash-fanny-a4bc10/f.webp",
      w: 2560,
      h: 1440,
      bytes: 549698,
    },
    window: { x: 0.3531, y: 0, w: 0.45, h: 1 },
    alt: "Fanny with orange hair in a high ponytail leaps through a bright blue sky with a thin blade in each hand and a glass city behind her.",
  },
  {
    slug: "guinevere",
    name: "Guinevere",
    kind: "video",
    poster: "/img/home/loops/guinevere-45.webp",
    posterBytes: 49448,
    posterFull: "/img/home/loops/guinevere-full.webp",
    posterFullBytes: 91892,
    video: { path: "/video/home/loops/guinevere.mp4", w: 1920, h: 1080, bytes: 1847405 },
    window: { x: 0.4359, y: 0, w: 0.3599, h: 0.8 },
    alt: "Guinevere, in the official animation of the series, cropped to her.",
  },
  {
    slug: "angela",
    name: "Angela",
    kind: "video",
    poster: "/img/home/loops/angela-45.webp",
    posterBytes: 38980,
    posterFull: "/img/home/loops/angela-full.webp",
    posterFullBytes: 89030,
    video: { path: "/video/home/loops/angela.mp4", w: 1920, h: 1080, bytes: 1277958 },
    window: { x: 0.4078, y: 0, w: 0.3599, h: 0.8 },
    alt: "Angela, in the official animation of the series, cropped to her.",
  },
  {
    slug: "lesley",
    name: "Lesley",
    kind: "video",
    poster: "/img/home/loops/lesley-45.webp",
    posterBytes: 45448,
    posterFull: "/img/home/loops/lesley-full.webp",
    posterFullBytes: 74236,
    video: { path: "/video/home/loops/lesley.mp4", w: 1920, h: 1080, bytes: 1435539 },
    window: { x: 0.3229, y: 0, w: 0.35, h: 0.7778 },
    alt: "Lesley, in the official animation of the series, cropped to her.",
  },
  {
    slug: "layla",
    name: "Layla",
    kind: "still",
    poster: "/img/home/cards/layla-45.webp",
    posterBytes: 109012,
    full: {
      lib: "arts/v2/splash/arts-splash-layla-f5d919/f.webp",
      w: 2560,
      h: 1440,
      bytes: 458304,
    },
    window: { x: 0.3844, y: 0, w: 0.45, h: 1 },
    alt: "Layla with long pink twin tails kneels behind a long white cannon while a round black droid with a cyan face floats in the foreground.",
  },
  {
    slug: "ruby",
    name: "Ruby",
    kind: "video",
    poster: "/img/home/loops/ruby-45.webp",
    posterBytes: 40762,
    posterFull: "/img/home/loops/ruby-full.webp",
    posterFullBytes: 91308,
    video: { path: "/video/home/loops/ruby.mp4", w: 1920, h: 1080, bytes: 1780001 },
    window: { x: 0.2609, y: 0, w: 0.3599, h: 0.8 },
    alt: "Ruby, in the official animation of the series, cropped to her.",
  },
  {
    slug: "vexana",
    name: "Vexana",
    kind: "video",
    poster: "/img/home/loops/vexana-45.webp",
    posterBytes: 50746,
    posterFull: "/img/home/loops/vexana-full.webp",
    posterFullBytes: 104420,
    video: { path: "/video/home/loops/vexana.mp4", w: 1920, h: 1080, bytes: 1494557 },
    window: { x: 0.4562, y: 0.0556, w: 0.3, h: 0.6667 },
    alt: "Vexana, in the official animation of the series, cropped to her.",
  },
  {
    slug: "change",
    name: "Chang'e",
    kind: "video",
    poster: "/img/home/loops/change-45.webp",
    posterBytes: 50624,
    posterFull: "/img/home/loops/change-full.webp",
    posterFullBytes: 72994,
    video: { path: "/video/home/loops/change.mp4", w: 1920, h: 1080, bytes: 1146862 },
    window: { x: 0.4198, y: 0, w: 0.3599, h: 0.8 },
    alt: "Chang'e, in the official animation of the series, cropped to her.",
  },
];

/** The tenth frame: Selena, drawn live in the stage, with her card until she is ready. */
export const SELENA_FRAME = {
  slug: "selena",
  name: "Selena",
  poster: "/img/home/cards/selena-45.webp",
  posterBytes: 157744,
} as const;
