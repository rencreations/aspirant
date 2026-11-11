import type { ArtsFile, ArtsItem, Facet } from "../core/types";

/** What a design sheet is. The head of the data file lists these with their counts. */
export const KIND_IDS = ["character", "mecha", "weapon", "droid", "other"] as const;

/** One design sheet. `img` is the whole sheet, never cropped; `what` is its kind. */
export interface DesignItem extends ArtsItem {
  what: string;
}

/** The head fields of `arts-design.json` beyond the common ones. */
export interface DesignHead {
  kinds?: Facet[];
}

export type DesignFile = ArtsFile<DesignItem> & DesignHead;

/** What the visitor has asked for: a search, a kind and an Aspirant. Empty means no limit. */
export interface DesignQuery {
  q: string;
  kind: string;
  who: string;
}
