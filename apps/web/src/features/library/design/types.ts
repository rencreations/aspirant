import type { PairId, Slug } from "@/content/types";

import type { Canon, CollectionFile, Credit, ItemBase, LibImage } from "../types";

/** One dominant colour: `#rrggbb` and its share of the picture, in percent. */
export type Swatch = [hex: string, percent: number];

export interface DesignSlide {
  img: LibImage;
  /** The five dominant colours, largest first. */
  pal: Swatch[];
  /** Weight of the full size file, in KB. */
  kb: number;
}

export interface DesignVideo {
  /** Library key of the film (H.264, AAC). */
  src: string;
  /** Library key of the poster the player shows. */
  poster: string;
  /** The reel's cover as posted. */
  cover: LibImage;
  pal: Swatch[];
  /** Seconds. */
  dur: number;
  w: number;
  h: number;
  kb: number;
}

type DesignKind = "poster" | "carousel" | "reel";

/** One promotional post of an official account. */
export interface DesignPost extends ItemBase {
  collection: "design";
  kind: DesignKind;
  /** The English caption, cleaned. */
  caption: string;
  /** ISO date of the post, `2024-07-31`. */
  date: string;
  /** `@mobilelegendsgame` or `@mgl_mlbb`. */
  account: string;
  campaign: string;
  /** The original post. */
  url: string;
  note?: string;
  /** Library key of a small picture, for search. */
  thumb: string;
  slides?: DesignSlide[];
  video?: DesignVideo;
  credit: Credit;
  canon: Canon;
  pair: PairId | null;
  chars: Slug[];
}

export interface DesignCampaign {
  id: string;
  title: string;
  line: string;
  from: string;
  to: string;
  chars: Slug[];
  /** Post ids, oldest first. */
  posts: string[];
}

export interface DesignTopic {
  tag: string;
  label: string;
}

export interface DesignFile extends CollectionFile<DesignPost> {
  campaigns: DesignCampaign[];
  topics: DesignTopic[];
}
