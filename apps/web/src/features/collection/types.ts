/**
 * Types and constants for the Collection archive. Everything here is plain data, so the
 * server builds the catalog once and passes it to the client islands as props.
 */
import type { PairId, Slug } from "@/content/types";

/** The seven sections of the archive, in page order. */
export const SECTION_IDS = [
  "films",
  "music",
  "comics",
  "art",
  "fanart",
  "models",
  "voice",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionMeta {
  id: SectionId;
  /** Heading of the section. */
  label: string;
  /** Short label for the filter button. */
  filterLabel: string;
  /** URL hash that opens this filter, for example "#fan-art". */
  hash: string;
  /** HUD code line. */
  code: string;
  /** One plain line under the heading. */
  blurb: string;
}

export const SECTIONS: readonly SectionMeta[] = [
  {
    id: "films",
    label: "Films",
    filterLabel: "Films",
    hash: "films",
    code: "01 / Films",
    blurb: "Trailers, showcases, behind the scenes and shorts. Hover to scrub, open to watch.",
  },
  {
    id: "music",
    label: "Music",
    filterLabel: "Music",
    hash: "music",
    code: "02 / Music",
    blurb: "Songs for the archive. Press play and keep browsing; the player stays with you.",
  },
  {
    id: "comics",
    label: "Comics",
    filterLabel: "Comics",
    hash: "comics",
    code: "03 / Comics",
    blurb: "Two webtoon strips. Read them top to bottom; we remember where you stopped.",
  },
  {
    id: "art",
    label: "Official art",
    filterLabel: "Art",
    hash: "art",
    code: "04 / Art",
    blurb: "Splash art and cutouts. Open one to zoom and pan.",
  },
  {
    id: "fanart",
    label: "Fan art",
    filterLabel: "Fan art",
    hash: "fan-art",
    code: "05 / Hall of fame",
    blurb:
      "Pieces made by readers and fans. Every artist is credited, with a link when we know one.",
  },
  {
    id: "models",
    label: "3D models",
    filterLabel: "3D",
    hash: "3d",
    code: "06 / 3D",
    blurb: "Layla and Fanny, turned all the way round. Drag to orbit.",
  },
  {
    id: "voice",
    label: "Voice archive",
    filterLabel: "Voice",
    hash: "voice",
    code: "07 / Voice",
    blurb: "Every line the ten recorded, with the Japanese title and an English translation.",
  },
];

export type FilmCategory =
  | "Trailer"
  | "Teaser"
  | "Skin showcase"
  | "Music video"
  | "Behind the scenes"
  | "Short"
  | "Character video"
  | "Comic video"
  | "Q and A";

/** Fields every collection item carries. */
export interface ItemBase {
  id: string;
  /** Human title in our own words. Never empty. */
  title: string;
  /** Text alternative for the thumbnail. Never empty. */
  alt: string;
  pair: PairId | null;
  /** Who the item is about, for the character filter. */
  characters: readonly Slug[];
}

export interface FilmItem extends ItemBase {
  kind: "film";
  category: FilmCategory;
  /** Public path of the MP4. */
  src: string;
  /** Public path of the poster JPG. */
  poster: string;
  /** Public path of the English captions (.vtt), when they exist. */
  captions: string | null;
  width: number;
  height: number;
  vertical: boolean;
  durationSec: number;
}

export interface TrackItem extends ItemBase {
  kind: "track";
  src: string;
  durationSec: number;
  /** What the track is, for example "Theme song". */
  role: string;
  /** Credit line, or a plain statement that it is not specified. */
  credit: string;
  /** Singer, for media keys and lock screens. Null when not specified. */
  artist: string | null;
  cover: { src: string; width: number; height: number };
}

export interface ComicPage {
  file: string;
  width: number;
  height: number;
  page: number;
}

export interface ComicItem extends ItemBase {
  kind: "comic";
  comicId: "aspirant" | "guinevere-vexana";
  pageCount: number;
  /** Original page numbers that are missing from the source. */
  missingPages: readonly number[];
  pages: readonly ComicPage[];
}

export type ArtKind = "Splash art" | "Cutout" | "Pose" | "Wallpaper" | "Pair art";

export interface ArtItem extends ItemBase {
  kind: "art";
  artKind: ArtKind;
  /** Full-size file for the viewer. */
  src: string;
  width: number;
  height: number;
  /** Smaller file for the grid. */
  thumb: string;
  thumbWidth: number;
  thumbHeight: number;
  /** Whether the file has a transparent background. */
  alpha: boolean;
}

export interface FanArtItem extends ItemBase {
  kind: "fanart";
  src: string;
  width: number;
  height: number;
  thumb: string;
  thumbWidth: number;
  thumbHeight: number;
  artist: string | null;
  /** Always shown. "Unknown artist, via Pixiv" when the artist is not in the file name. */
  credit: string;
  /** Link to the original. Null when no link is known or it is not trusted. */
  url: string | null;
  /** Dominant colour of the piece, for the glow. */
  color: string;
}

export interface ModelItem extends ItemBase {
  kind: "model";
  slug: Slug;
  src: string;
  /** Still image shown before the viewer loads. */
  poster: { src: string; width: number; height: number };
  /** The eight face-screen textures of the robot companion. */
  emotes: readonly string[];
}

export interface VoiceItem extends ItemBase {
  kind: "voice";
  slug: Slug;
  n: number;
  jpTitle: string;
  en: string;
  file: string;
  durationSec: number;
}

export type CollectionItem =
  FilmItem | TrackItem | ComicItem | ArtItem | FanArtItem | ModelItem | VoiceItem;

export interface CatalogStats {
  counts: Record<SectionId, number>;
  filmSeconds: number;
  musicSeconds: number;
  voiceSeconds: number;
  /** Films, music and voice together. */
  totalSeconds: number;
}

export interface Catalog {
  films: readonly FilmItem[];
  music: readonly TrackItem[];
  comics: readonly ComicItem[];
  art: readonly ArtItem[];
  fanart: readonly FanArtItem[];
  models: readonly ModelItem[];
  voice: readonly VoiceItem[];
  stats: CatalogStats;
}

/**
 * What the client receives. The 380 voice lines are not sent as items (the voice archive
 * loads the text from the content module); only their durations travel with the page.
 */
export type ClientCatalog = Omit<Catalog, "voice"> & {
  voiceDurations: Readonly<Record<Slug, readonly number[]>>;
};

/** The character or pair the visitor is filtering by. */
export type WhoFilter =
  { type: "all" } | { type: "pair"; id: PairId } | { type: "char"; slug: Slug };
