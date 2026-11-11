import type { CollectionSlug } from "./types";

/** What the shelf, the switcher and the page headers say about each collection. */
export interface CollectionMeta {
  slug: CollectionSlug;
  /** Position on the shelf, `01` to `10`. */
  index: string;
  name: string;
  /** One line under the name in the focus view of the shelf. */
  tagline: string;
  /** One sentence for the page header and the page description. */
  line: string;
  /** Signature colour of the cover and the page. */
  colour: string;
  /** A dark tone of the colour, for text on light. */
  ink: string;
  /** Key of the 1024 square cover picture (made by `scripts/library/covers.py`). */
  cover: string;
  /** Shelf row, 1 or 2. */
  shelf: 1 | 2;
}

export const COLLECTIONS: readonly CollectionMeta[] = [
  {
    slug: "arts",
    index: "01",
    name: "Arts",
    tagline: "Every official picture, and a still from every scene.",
    line: "Splash art, lore cards and a still from every scene of every animated film.",
    colour: "#e0245e",
    ink: "#7a0f33",
    cover: "covers/arts.webp",
    shelf: 1,
  },
  {
    slug: "video",
    index: "02",
    name: "Video",
    tagline: "Ten films, and every other video.",
    line: "Two rooms of video: the ten official films, one by one, and everything else that moves.",
    colour: "#2a5bff",
    ink: "#0f2a86",
    cover: "covers/video.webp",
    shelf: 1,
  },
  {
    slug: "music",
    index: "03",
    name: "Music",
    tagline: "The songs and the page themes.",
    line: "The songs and the page themes of The Aspirants, with their credits and links.",
    colour: "#7c4dff",
    ink: "#3a1d95",
    cover: "covers/music.webp",
    shelf: 1,
  },
  {
    slug: "voicelines",
    index: "04",
    name: "Voicelines",
    tagline: "All 380 lines, in Japanese and English.",
    line: "Every voice line of the ten Aspirants, with the Japanese and the English.",
    colour: "#08a39f",
    ink: "#04504e",
    cover: "covers/voicelines.webp",
    shelf: 1,
  },
  {
    slug: "fanart",
    index: "05",
    name: "Fanart",
    tagline: "Made by readers and fans. Every piece credited.",
    line: "Fan art, fan films and cosplay, each with its maker and a link to the original.",
    colour: "#ff7a1a",
    ink: "#8a3a00",
    cover: "covers/fanart.webp",
    shelf: 1,
  },
  {
    slug: "comic",
    index: "06",
    name: "Comic",
    tagline: "Two official strips, and the fans' own.",
    line: "The two official webtoons with their text, and the fan comics.",
    colour: "#f0b100",
    ink: "#6b4e00",
    cover: "covers/comic.webp",
    shelf: 2,
  },
  {
    slug: "lore",
    index: "07",
    name: "Lore",
    tagline: "Every person, place and thing of the story.",
    line: "A page for everything the story names, with how it ties together, beside the official texts and an atlas.",
    colour: "#2f8f5b",
    ink: "#164a2e",
    cover: "covers/lore.webp",
    shelf: 2,
  },
  {
    slug: "design",
    index: "08",
    name: "Design",
    tagline: "Posters, posts and promotional pieces.",
    line: "The promotional posts and graphics, by campaign, with their captions.",
    colour: "#ff3d97",
    ink: "#8a0f4c",
    cover: "covers/design.webp",
    shelf: 2,
  },
  {
    slug: "animation",
    index: "09",
    name: "Animation",
    tagline: "The in-game animation. Press a button and watch it move.",
    line: "The in-game animation of every Aspirant, cut smoothly from one clip to the next.",
    colour: "#10a5d8",
    ink: "#075470",
    cover: "covers/animation.webp",
    shelf: 2,
  },
  {
    slug: "others",
    index: "10",
    name: "Others",
    tagline: "Everything that fits nowhere else.",
    line: "The 3D models, the emotes, the gameplay clips and the odds and ends.",
    colour: "#5d6b82",
    ink: "#2a3342",
    cover: "covers/others.webp",
    shelf: 2,
  },
];

export function getCollection(slug: CollectionSlug): CollectionMeta {
  const found = COLLECTIONS.find((c) => c.slug === slug);
  if (!found) throw new Error(`Unknown collection ${slug}`);
  return found;
}

/** The collection after this one on the shelf (the last one leads back to the first). */
export function nextCollection(slug: CollectionSlug): CollectionMeta {
  const i = COLLECTIONS.findIndex((c) => c.slug === slug);
  return COLLECTIONS[(i + 1) % COLLECTIONS.length] ?? COLLECTIONS[0]!;
}
