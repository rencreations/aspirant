import type { CollectionFile, ItemBase, LibVideo } from "../types";

/** What a film is, in the order the room lists them. */
export type FilmKind =
  | "trailer"
  | "teaser"
  | "character"
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
  | "parody";

/** One scene of a film: where it starts (seconds) and a short plain caption. */
export interface FilmChapter {
  t: number;
  l: string;
}

export interface Film extends ItemBase {
  collection: "films";
  kind: FilmKind;
  /** One or two plain sentences. */
  desc: string;
  video: LibVideo;
  /** Key of the 480 wide poster, for the cards. */
  thumb: string;
  /** Average colour of the poster. */
  c: string;
  /** Size in bytes of the file that plays. */
  bytes: number;
  chapters: FilmChapter[];
  /** ISO date of the first post, when the sources know it. */
  date?: string;
  /** Ids of other official files that are the same film (the drama is posted under two or three ids). */
  also?: string[];
  /** A page that holds more of the same, for example Vexana's page for the drama. */
  link?: { href: string; label: string };
  /** The drama chapter, 1 to 6. */
  group?: number;
}

export interface FilmsFile extends CollectionFile<Film> {
  /** Id of the film the room opens with. */
  featured: string;
  /** Total bytes of the films that play. */
  bytes: number;
}
