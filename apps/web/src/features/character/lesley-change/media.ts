import type { QualityOption } from "@/components/video-player/player-math";

/** The two pages of this pair (Lesley and Chang'e share one design: the open channel). */
export type Who = "lesley" | "change";

export const PARTNER: Readonly<Record<Who, Who>> = { lesley: "change", change: "lesley" };

/** Each page's hero is its own splash art, shown full bleed. */
export const HERO: Readonly<
  Record<
    Who,
    {
      src: string;
      width: number;
      height: number;
      alt: string;
      position: string;
      face: string;
      /** `background-position` of the tall crop beside the notes. */
      tall: string;
    }
  >
> = {
  lesley: {
    src: "/img/char/lesley/splash.webp",
    width: 2048,
    height: 1152,
    alt: "Lesley leaping across a steel frame above the city with her sniper rifle, official splash art",
    position: "58% 40%",
    /** `background-position` that puts her face in the middle of a card. */
    face: "55% 34%",
    tall: "66% 50%",
  },
  change: {
    src: "/img/char/change/splash.webp",
    width: 2048,
    height: 1152,
    alt: "Chang'e riding the Crescent Moon beside Mr. Bunny, official splash art",
    position: "60% 40%",
    face: "56% 27%",
    tall: "74% 50%",
  },
};

/** Where things sit in each splash art, as a share of the picture (x, y). */
export const SPOTS = {
  /** Lesley's rifle muzzle, where the shot leaves. */
  muzzle: { x: 0.89, y: 0.53 },
  /** The ring of light around Chang'e's head, where the ripples start. */
  ring: { x: 0.68, y: 0.34 },
  /** Where the scope rests when the page opens: Lesley's eye. */
  eye: { x: 0.62, y: 0.3 },
} as const;

/** The three things on Chang'e's art that can be pressed. Every line is from the content layer. */
export interface Marker {
  id: string;
  name: string;
  x: number;
  y: number;
  text: string;
}

export const MARKERS: readonly Marker[] = [
  {
    id: "moon",
    name: "Crescent Moon",
    x: 0.36,
    y: 0.5,
    text: "Her flying board, shaped like a crescent. She rides it into the fight.",
  },
  {
    id: "bunny",
    name: "Mr. Bunny",
    x: 0.85,
    y: 0.72,
    text: "Her best friend, rebuilt from a tin rabbit. He can unfold into a giant the size of a house and carry her into battle.",
  },
  {
    id: "ears",
    name: "Headset",
    x: 0.655,
    y: 0.11,
    text: "A headset shaped like rabbit ears, over bright pink twin-tails with a green streak.",
  },
];

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

const DIR = "/video/lesley-change";

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

/** The films of the pair, by id. Sizes are the files in `public/video/lesley-change/`. */
export const FILMS = {
  trailer: film(
    "trailer",
    "Trailer",
    "The official trailer of the series, with the fall of Selrick Base.",
    540,
    157.3,
    19583908,
    true,
  ),
  teaser: film(
    "teaser",
    "Teaser",
    "The teaser, told in Chang'e's recorded messages.",
    360,
    60.2,
    3449378,
  ),
  skin: film("skin-showcase", "Skin showcase", "Both skins in motion.", 360, 166.6, 10798923),
} as const satisfies Record<string, Film>;

export function sourcesOf(f: Film): QualityOption[] {
  return [{ label: `${f.height}p`, height: f.height, src: f.src }];
}

/** The pair's art as it appears in the gallery. The sources hold no fan art for this pair. */
export interface OfficialArt {
  src: string;
  width: number;
  height: number;
  alt: string;
  title: string;
}

const TITLES: Readonly<Record<Who, string>> = {
  lesley: "Lesley, Deadeye Spectre",
  change: "Chang'e, Tech Tensai",
};

export function officialArt(who: Who): OfficialArt[] {
  return [who, PARTNER[who]].map((w) => ({
    src: HERO[w].src,
    width: HERO[w].width,
    height: HERO[w].height,
    alt: HERO[w].alt,
    title: TITLES[w],
  }));
}

/**
 * Where a point of a picture lands when the picture covers a box (`object-fit: cover` with an
 * `object-position` given as shares 0..1). `nx` and `ny` are shares of the picture.
 */
export function coverPoint(
  nx: number,
  ny: number,
  box: { w: number; h: number },
  pic: { w: number; h: number },
  pos: { x: number; y: number },
): { x: number; y: number } {
  const s = Math.max(box.w / pic.w, box.h / pic.h);
  const w = pic.w * s;
  const h = pic.h * s;
  return { x: (box.w - w) * pos.x + nx * w, y: (box.h - h) * pos.y + ny * h };
}

/** `"58% 40%"` as shares. */
export function parsePosition(p: string): { x: number; y: number } {
  const [a, b] = p.split(" ").map((n) => Number.parseFloat(n) / 100);
  return { x: a ?? 0.5, y: b ?? 0.5 };
}
