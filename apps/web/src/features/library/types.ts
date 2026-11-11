import type { PairId, Slug } from "@/content/types";

/**
 * The ten collections, in shelf order (row one: the first five, row two: the last five). Fanart is
 * not one of them since 11 Nov 2026: it is a room of Arts (`/collection/arts/fanart`), and slot 05
 * is the 3D Models room.
 */
export const COLLECTION_SLUGS = [
  "arts",
  "video",
  "music",
  "voicelines",
  "models",
  "comic",
  "lore",
  "design",
  "animation",
  "others",
] as const;

export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];

export function isCollectionSlug(value: string): value is CollectionSlug {
  return (COLLECTION_SLUGS as readonly string[]).includes(value);
}

/**
 * The Video collection holds two rooms: Films (the ten official films, shown one by one) and Others
 * (every other video). Routes: `/collection/video` (the choice), `/collection/video/films` and
 * `/collection/video/others`.
 */
export const VIDEO_ROOMS = ["films", "others"] as const;

export type VideoRoom = (typeof VIDEO_ROOMS)[number];

export function isVideoRoom(value: string): value is VideoRoom {
  return (VIDEO_ROOMS as readonly string[]).includes(value);
}

/**
 * How an item relates to the story. Official is made by the studio. Fan is made by readers and
 * players (fan art, fan comics, fan films, cosplay, edits, gameplay). Non-canon is official or
 * semi official work that the story does not count (the live-action parody).
 */
export type Canon = "official" | "fan" | "non-canon";

/** A picture in three sizes. `t`, `p` and `f` are library keys (see `libUrl`). */
export interface LibImage {
  /** Thumbnail, 480 on the long side. */
  t: string;
  /** Preview, 1280 on the long side. */
  p: string;
  /** Full quality, up to 3840 on the long side. */
  f: string;
  /** Width and height of the full size picture. */
  w: number;
  h: number;
  /** Average colour, `#rrggbb`, for a placeholder while the picture loads. */
  c: string;
}

/** A video file. `src` and `poster` are library keys, or `local` is a path in `public/` for a film the site already ships. */
export interface LibVideo {
  src: string;
  poster: string;
  /** WebVTT captions, a library key. */
  captions?: string;
  w: number;
  h: number;
  /** Seconds. */
  dur: number;
  /** A path in `public/` (for example `/video/ruby-angela/trailer.mp4`) used instead of `src`. */
  local?: string;
}

/** Who made an item, and where it was first posted. Every fan item has one. */
export interface Credit {
  /** The artist or account, or null when the sources do not name one. */
  by: string | null;
  /** Instagram, DeviantArt, TikTok, Reddit, X, Pixiv, Facebook, ArtStation, Medibang and so on. */
  platform: string | null;
  /** The original post, when the sources know it. */
  url: string | null;
  /** ISO date of the post, when known. */
  date?: string;
  note?: string;
}

/** What every item of every collection has. A collection adds its own fields. */
export interface ItemBase {
  /** Stable, unique across the library, for example `arts-official-layla-splash`. */
  id: string;
  title: string;
  collection: CollectionSlug;
  /** The Aspirants it shows or is about. */
  chars: Slug[];
  pair: PairId | null;
  canon: Canon;
  /** Free filter words in lower case, for example `splash`, `trailer`. */
  tags: string[];
  credit?: Credit;
}

/** The file of one collection: `public/data/library/<slug>.json`. */
export interface CollectionFile<T extends ItemBase = ItemBase> {
  v: 1;
  slug: CollectionSlug;
  items: T[];
}

/** One line of `public/data/library/search.json`, built from every collection file. */
export interface SearchEntry {
  id: string;
  /** Collection. */
  c: CollectionSlug;
  /** Title. */
  t: string;
  /** Characters. */
  w: Slug[];
  /** The room of an Arts picture (`splash`, `scene`, `fanart`, `cosplay` ...): where `?i=<id>` opens it. */
  r?: string;
  /** Kind or tags, joined, lower case, for matching. */
  k: string;
  /** Small picture key for the result row, when the item has one. */
  i?: string;
}
