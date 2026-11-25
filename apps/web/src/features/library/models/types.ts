import type { CollectionFile, ItemBase, LibImage } from "../types";

/**
 * How the camera may move round a view.
 *
 * - `character`: it turns round her and rises above her, but never goes under the plane of the
 *   target, and the target never drops below her hips. No pan.
 * - `item`: the object turns freely on every axis (a trackball), so every side can be seen.
 * - `free`: anywhere (the whole sphere, zoom and pan). Selena's In Game and Entrance, Silverbolt.
 */
export type ViewMode = "character" | "item" | "free";

/**
 * What moves in a view.
 *
 * - `still`: nothing (the visitor turns it).
 * - `breathe`: a quiet idle made in the room by the Mixamo bones (Ruby, Angela).
 * - `clips`: the file's clips, listed for the visitor (Silverbolt).
 * - `cinematic`: the clips, each with the game's camera (Selena's Entrance).
 * - `forms`: two forms with their clips and the change between them (Selena In Game).
 * - `drone`, `pair`, `bunny`, `tetra`: a small show of their own.
 */
type ViewBehaviour =
  "still" | "breathe" | "clips" | "cinematic" | "forms" | "drone" | "pair" | "bunny" | "tetra";

/** One clip the visitor can pick. Clips with a `group` are one dropdown (In, Loop, Out). */
export interface ClipRef {
  id: string;
  label: string;
  group?: string;
  groupLabel?: string;
}

/** One form of a view with forms (Selena: Normal, Abyssal), and its clips. */
export interface ClipForm {
  id: string;
  label: string;
  clips: ClipRef[];
}

/** The picture of a view: the list and the stage without WebGL. */
interface ViewPoster {
  /** 240 by 300. */
  t: string;
  /** 800 by 1000. */
  p: string;
  w: number;
  h: number;
}

/** One view: one model file, one thing on the stage. */
export interface ModelView {
  /** Unique in the room, and the `v` of the address. */
  id: string;
  label: string;
  mode: ViewMode;
  behaviour: ViewBehaviour;
  /** The GLB, a key of the library. */
  file: string;
  bytes: number;
  poster: ViewPoster;
  clips?: ClipRef[];
  forms?: ClipForm[];
  defaultClip?: string;
  /** The angle a view opens at, in radians: an item's turn round its upright and its tilt, or the camera's yaw and pitch. */
  home?: [number, number];
}

/** One entry of the list: a character (and her items) or a companion. */
export interface ModelEntry extends ItemBase {
  kind: "model";
  /** The Aspirant's title (Blade of Kibou). Only for an Aspirant. */
  aspirant?: string;
  views: ModelView[];
  /** The poster of the first view, for the search. */
  img: LibImage;
}

export type ModelsFile = CollectionFile<ModelEntry>;
