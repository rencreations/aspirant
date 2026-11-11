import type { ItemBase, LibImage } from "../../types";
import type { ArtsRoom } from "./routes";

/**
 * One picture of an Arts room (`public/data/library/arts-<room>.json`, made by
 * `scripts/library/arts_rooms/<room>.py`). `img` is the whole picture, never cropped: a room that
 * shows a window on it (Splash art) reads the window from its own fields.
 */
export interface ArtsItem extends ItemBase {
  collection: "arts";
  room: ArtsRoom;
  /** The whole picture in three sizes: `t` 480, `p` 1280, `f` up to 3840 (more for a tall comic strip). */
  img: LibImage;
  /** One plain sentence about what is seen. */
  alt: string;
  /** The entity folders of the source the picture was found in (`oro-attack`, `android`, `angela`), most common first. */
  places: string[];
}

/** A line of a filter: an entity, an Aspirant, a kind. `count` is the number of pictures it holds. */
export interface Facet {
  id: string;
  name: string;
  count: number;
}

/** The data file of one Arts room. A room adds its own head fields (`facets`, `comics`, `kinds`, `characters`). */
export interface ArtsFile<T extends ArtsItem = ArtsItem> {
  v: 1;
  slug: string;
  room: ArtsRoom;
  items: T[];
  facets?: Facet[];
}

/** A fraction rectangle on a picture: `x`, `y`, `w`, `h` from 0 to 1 of the whole picture. */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
