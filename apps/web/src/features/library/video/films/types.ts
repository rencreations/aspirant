import type { CollectionFile, ItemBase, LibVideo } from "../../types";

/** What a film is. The labels are in `film-math.ts` (`KIND_LABEL`). */
export type FilmKind = "cinematic-trailer" | "character-trailer" | "animated-trailer" | "animation";

/** One of the ten films of the Films room (`public/data/library/video-films.json`). */
export interface FilmWork extends ItemBase {
  collection: "video";
  kind: FilmKind;
  /** The year of the first post, when the sources know it. */
  year?: number;
  /** ISO date of the first post, when the sources know it. */
  date?: string;
  /** One or two plain sentences. */
  desc: string;
  /** The film at full quality (H.264, the source's own size), its poster and its captions. */
  video: LibVideo;
  /** Key of the 480 wide poster, for the contents sheet. */
  thumb: string;
  /** Key of a small blurred copy of the poster, shown around a film that fits inside a tall screen. */
  backdrop: string;
  /** Average colour of the poster. */
  c: string;
  /** Frames a second of the file. */
  fps: number;
  /** Size in bytes of the file. */
  bytes: number;
}

export interface FilmsFile extends CollectionFile<FilmWork> {
  room: "films";
  /** Total bytes of the ten files. */
  bytes: number;
}
