import type { CollectionFile, ItemBase } from "../types";

export type MusicKind = "song" | "theme" | "piece" | "compilation";

interface MusicCredit {
  /** `Music`, `Lyrics`, `Vocals` and so on, as the title cards of the soundtrack film put it. */
  role: string;
  name: string;
}

interface MusicFilmLink {
  /** Id of the film in the Films room. */
  id: string;
  label: string;
  /** Where the track starts in that film, in seconds. */
  t?: number;
}

/** A cover is either a library picture (`t`, `p`, `f` keys) or a picture of the site (`site`, a path in `public/`). */
export interface MusicCover {
  t?: string;
  p?: string;
  f?: string;
  c?: string;
  site?: string;
}

interface MusicChapter {
  t: number;
  title: string;
}

export interface MusicItem extends ItemBase {
  kind: MusicKind;
  /** `EP 01` and so on, from the soundtrack film. Null for a piece with no number. */
  ep: string | null;
  credits: MusicCredit[];
  /** Month and year of the release (`10/2026`), when the film gives it. */
  released: string | null;
  /** Library key of the stream (AAC). */
  src: string;
  /** Seconds. */
  dur: number;
  cover: MusicCover;
  films: MusicFilmLink[];
  about: string;
  /** What the file is, in plain words. */
  quality: string;
  /** Library key of the original file, for the download. */
  orig?: string;
  chapters?: MusicChapter[];
  /** Library key of the face of the track's disc (a square picture, `discs.py`). */
  disc?: string;
  /** The loudness of the track in equal steps, one base 36 digit each (`discs.py`). */
  wave?: string;
}

export interface MusicFile extends CollectionFile<MusicItem> {
  totals: { tracks: number; seconds: number };
}
