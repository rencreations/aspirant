import type { PairId, Slug } from "@/content/types";

import type { LibImage } from "../../types";

/** The data file of the scene stills (a path in `public/`). Made by `scripts/library/arts/scenes.py`. */
export const SCENES_FILE = "/data/library/arts-scenes.json";

/** A section of a film that the footage notes describe (3 to 49 seconds, several shots). */
export interface SceneBeat {
  /** Number of the section in the film, from 1. */
  i: number;
  /** Start and end in seconds. */
  from: number;
  to: number;
  /** What happens, in one plain sentence. */
  note: string;
}

/** One still: a distinct shot of a film. */
export interface Scene {
  id: string;
  /** Seconds into the film. */
  t: number;
  /** `mm:ss`. */
  time: string;
  /** The note of the section that holds this moment, or an empty string when the film has none. */
  note: string;
  img: LibImage;
  /** The section (`SceneBeat.i`) the still belongs to, or null. */
  beat: number | null;
}

export interface SceneFilm {
  /** The id the Films room uses (`film-...`), so a still can link to `/collection/films?i=<id>&t=<seconds>`. */
  id: string;
  title: string;
  pair: PairId;
  chars: Slug[];
  /** trailer, teaser, character film, short film, interactive drama and so on. */
  kind: string;
  /** Seconds. */
  duration: number;
  /** Size of the stills (bars cropped). */
  w: number;
  h: number;
  beats: SceneBeat[];
  scenes: Scene[];
  /** Index in `scenes` of the still that stands for the film. */
  poster: number;
}

export interface ScenesFile {
  v: 1;
  films: SceneFilm[];
  totals: { films: number; scenes: number };
  /** The film (index in `films`) of every still in order. Only its length is read by the Arts page. */
  items: number[];
}

/** A film after the filters: the stills that match, and the sections they fall in. */
export interface ShownFilm {
  film: SceneFilm;
  scenes: Scene[];
  /** The stills in groups by section, in time order. A film without sections has one group. */
  groups: SceneGroup[];
}

export interface SceneGroup {
  key: string;
  beat: SceneBeat | null;
  scenes: Scene[];
}

export interface SceneFilters {
  q: string;
  who: string;
  pair: string;
  film: string;
}

export type SceneView = "strips" | "sheet";
