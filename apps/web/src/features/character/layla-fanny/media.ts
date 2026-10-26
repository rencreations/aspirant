import type { QualityOption } from "@/components/video-player/player-math";

/** The two pages of this pair (Layla and Fanny share one design: the line that carries the beam). */
export type Who = "layla" | "fanny";

export const PARTNER: Readonly<Record<Who, Who>> = { layla: "fanny", fanny: "layla" };

export const MUSIC = "/audio/music/we-believe.m4a";

/** The pair's official pictures that sit on both pages. */
export const PAIR_SPLASH = "/img/pair/fanny-layla/fighting-together-splash-art.webp";
export const PAIR_OFFICIAL = "/img/pair/fanny-layla/fanny-and-layla.webp";

/** Each page's hero: Layla's wide cut-out and Fanny's flying pose (both transparent). */
export const HERO: Readonly<
  Record<Who, { src: string; width: number; height: number; alt: string }>
> = {
  layla: {
    src: "/img/char/layla/cutout.webp",
    width: 3200,
    height: 1800,
    alt: "Layla crouching behind her white cannon, official art",
  },
  fanny: {
    src: "/img/char/fanny/extra-1.webp",
    width: 1272,
    height: 1800,
    alt: "Fanny in flight with her twin blades, official art",
  },
};

export interface Film {
  id: string;
  title: string;
  /** One plain line under the title. Facts only. */
  note: string;
  src: string;
  height: number;
  poster: string;
  captions?: string;
  durationSec: number;
  bytes: number;
}

const DIR = "/video/fanny-layla";

function film(
  id: string,
  title: string,
  note: string,
  height: number,
  durationSec: number,
  bytes: number,
  captions = false,
): Film {
  return {
    id,
    title,
    note,
    src: `${DIR}/${id}.mp4`,
    height,
    poster: `${DIR}/${id}.jpg`,
    ...(captions ? { captions: `${DIR}/${id}.vtt` } : {}),
    durationSec,
    bytes,
  };
}

/** The films of the pair, by id. Sizes are the files in `public/video/fanny-layla/`. */
export const FILMS = {
  trailer: film(
    "trailer",
    "Trailer",
    "The official trailer of the series.",
    720,
    100.7,
    12299050,
    true,
  ),
  skin: film("skin-showcase", "Skin showcase", "Both skins in motion.", 540, 109.4, 9225100),
  short: film(
    "short-animation",
    "Short animation",
    "A short animation of the two in training.",
    540,
    104.8,
    9425957,
    true,
  ),
  music: film("music-video", "Music video", "We Believe, the pair's theme.", 720, 308.5, 30881910),
  musicBts: film(
    "music-bts",
    "Music, behind the scenes",
    "How the theme was made.",
    360,
    527.5,
    24607590,
  ),
  producer: film(
    "music-producer-talk",
    "Talk with the producer",
    "The producer speaks about the theme, in Japanese.",
    360,
    59,
    1493657,
  ),
  idea: film(
    "idea-bts",
    "The idea, behind the scenes",
    "How the series came to be, in English.",
    540,
    160.3,
    14038598,
  ),
} as const satisfies Record<string, Film>;

export function sourcesOf(f: Film): QualityOption[] {
  return [{ label: `${f.height}p`, height: f.height, src: f.src }];
}

/** The pair's art as it appears in the gallery (the official pictures, then the fan art). */
export interface OfficialArt {
  src: string;
  width: number;
  height: number;
  alt: string;
  title: string;
}

export function officialArt(who: Who): OfficialArt[] {
  const own: OfficialArt[] =
    who === "layla"
      ? [
          {
            src: "/img/char/layla/splash.webp",
            width: 2048,
            height: 1152,
            alt: "Layla, official splash art",
            title: "Miss Hikari",
          },
        ]
      : [
          {
            src: "/img/char/fanny/splash.webp",
            width: 2048,
            height: 1152,
            alt: "Fanny, official splash art",
            title: "Blade of Kibou",
          },
          {
            src: "/img/char/fanny/extra-1.webp",
            width: 1272,
            height: 1800,
            alt: "Fanny in flight, official art",
            title: "In flight",
          },
        ];
  return [
    ...own,
    {
      src: PAIR_SPLASH,
      width: 2048,
      height: 1152,
      alt: "Fanny and Layla fighting together, official splash art",
      title: "Fighting together",
    },
    {
      src: PAIR_OFFICIAL,
      width: 1000,
      height: 563,
      alt: "Fanny and Layla, official art",
      title: "Fanny and Layla",
    },
  ];
}
