import type { CollectionFile, ItemBase, LibVideo } from "../../types";

/**
 * What a video is. A kind belongs to one shelf of the room (`SHELVES` in `video-data.ts`). The same
 * names are the `kind` of the data file, made by `scripts/library/films/build.py`.
 */
export type VideoKind =
  | "trailer"
  | "teaser"
  | "lore"
  | "short"
  | "social"
  | "showcase"
  | "music"
  | "behind-the-scenes"
  | "interview"
  | "event"
  | "drama"
  | "livestream"
  | "match"
  | "parody"
  | "reel"
  | "gameplay"
  | "emote"
  | "edit"
  | "fan";

/** One scene of a video: where it starts (seconds) and a short plain caption. */
export interface VideoScene {
  t: number;
  l: string;
}

export interface OtherVideo extends ItemBase {
  collection: "video";
  kind: VideoKind;
  /** One or two plain sentences. */
  desc: string;
  video: LibVideo;
  /** Key of the 480 wide poster, for the tiles. */
  thumb: string;
  /** Average colour of the poster. */
  c: string;
  /** Width over height of the poster (the tile has this shape). */
  ar: number;
  /** Eight frames across the video side by side in one picture, for the hover preview. */
  strip: { src: string; n: number };
  /** Size in bytes of the file that plays. */
  bytes: number;
  chapters: VideoScene[];
  /** ISO date of the first post, when the sources know it. */
  date?: string;
  /** Ids of other files that are the same video (the drama is posted under two or three ids). */
  also?: string[];
  /** A page that holds more of the same, for example the page of the interactive drama. */
  link?: { href: string; label: string };
  /** The drama chapter, 1 to 6. */
  group?: number;
}

export interface OthersFile extends CollectionFile<OtherVideo> {
  room: "others";
  /** Total bytes of the videos that play. */
  bytes: number;
}
