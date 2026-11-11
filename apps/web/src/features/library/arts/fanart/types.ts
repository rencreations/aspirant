import type { PairId } from "@/content/types";

import type { ItemBase, LibImage, LibVideo } from "../../types";
import type { ArtsItem } from "../core/types";

/** Fanart holds pictures and videos. The twelve cosplay photos moved to the Cosplay rooms. */
type FanKind = "image" | "video";

/** What `public/data/library/arts-fanart.json` holds for one piece, as it is written. */
export interface FanRaw extends ItemBase {
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

/** One piece as the room uses it: the file's fields, made into what the flow reads (`adaptFan`). */
export interface FanItem extends Omit<FanRaw, "collection">, ArtsItem {
  room: "fanart";
}
