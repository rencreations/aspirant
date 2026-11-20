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
    kind: "still",
    poster: "/img/home/cards/guinevere-45.webp",
    posterBytes: 176824,
    full: {
      lib: "arts/v2/splash/arts-splash-guinevere-915d8d/f.webp",
      w: 2560,
      h: 1440,
      bytes: 768532,
    },
    window: { x: 0.3891, y: 0, w: 0.45, h: 1 },
    alt: "Guinevere with long pale hair that fades to violet and a red bow leaps through the sky with gold star blades, round droids and glowing red crystals around her.",
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
    kind: "still",
    poster: "/img/home/cards/ruby-45.webp",
    posterBytes: 139348,
    full: {
      lib: "arts/v2/splash/arts-splash-ruby-753f93/f.webp",
      w: 2560,
      h: 1440,
      bytes: 559054,
    },
    window: { x: 0.2168, y: 0, w: 0.45, h: 1 },
    alt: "Ruby with dark hair and pink ends swings a huge white and orange blade over a blue night city, with dark machine hands reaching in from the right.",
  },
  {
    slug: "vexana",
    name: "Vexana",
    kind: "still",
    poster: "/img/home/cards/vexana-45.webp",
    posterBytes: 179342,
    full: {
      lib: "arts/v2/splash/arts-splash-vexana-6a1b9d/f.webp",
      w: 2560,
      h: 1440,
      bytes: 756620,
    },
    window: { x: 0.4141, y: 0.1556, w: 0.3801, h: 0.8444 },
    alt: "Vexana with silver blue hair stands on a rooftop at night in front of a huge dark mecha that holds a giant violet sword.",
  },
  {
    slug: "change",
    name: "Chang'e",
    kind: "video",
    poster: "/img/home/loops/change-45-v2.webp",
    posterBytes: 51648,
    posterFull: "/img/home/loops/change-full.webp",
    posterFullBytes: 72994,
    video: { path: "/video/home/loops/change.mp4", w: 1920, h: 1080, bytes: 1146862 },
    // Round nine: zoomed out a little (970 of 1080 rows) and moved left over the banner so she stands in the middle.
    window: { x: 0.3333, y: 0, w: 0.4042, h: 0.8981 },
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
