import type { PairId } from "@/content/types";

import type { GalleryItem } from "../shared/gallery";
import type { ItemBase, LibImage, LibVideo } from "../types";

type FanKind = "image" | "video" | "cosplay";

/** One piece in `public/data/library/fanart.json`. */
export interface FanItem extends ItemBase {
  kind: FanKind;
  /** Every pair that has an Aspirant in the piece. `pair` is set only when there is one. */
  pairs: PairId[];
  platform: string | null;
  /** ISO date of the post, when known. */
  date: string | null;
  /** Lower case key of the single credited artist. Null for group posts, unnamed work and official reels. */
  artist: string | null;
  /** The picture. For a video it is the poster. */
  img: LibImage;
  video?: LibVideo;
  /** Source files this piece stands for (copies are merged into one). */
  src: string[];
}

/** A picture as the shared gallery and viewer read it. */
export type FanPicture = FanItem & GalleryItem;

/** What the kind chips say. */
export type KindFilter = "" | "art" | "cosplay" | "video";

export interface Filters {
  q: string;
  /** A pair id, or "". */
  pair: string;
  /** A character slug, or "". */
  who: string;
  /** A platform name, or "". */
  platform: string;
  kind: KindFilter;
}

export const NO_FILTERS: Filters = { q: "", pair: "", who: "", platform: "", kind: "" };
