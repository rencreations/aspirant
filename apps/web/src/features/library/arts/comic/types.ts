import type { ArtsItem, Facet } from "../core/types";

/** The two webtoons the panels come from. */
export type ComicId = "the-aspirant" | "guinevere-vexana";

/**
 * One picture of the Comic room: a panel of a webtoon without its words (`arts-comic.json`, made
 * by `scripts/library/arts_rooms/comic.py`). The file lists the panels in reading order: the comic,
 * then the page, then the row of the picture on its page.
 */
export interface ComicItem extends ArtsItem {
  room: "comic";
  comic: ComicId;
  page: number;
  /** The number of the panel on its page, or null when the sources do not give one. */
  panel: number | null;
  /** `tall` is under 2:3, `wide` is 3:2 and wider, the rest is `square`. */
  shape: "tall" | "square" | "wide";
  /** Width over height. */
  ratio: number;
  /** The corners of the picture are transparent: it is a cut out of the page, shown with nothing behind it. */
  alpha: boolean;
  /** A line about how the picture was cut (a panel cut from a page, a whole page). */
  note?: string;
}

/** The head fields of `arts-comic.json`. */
export interface ComicHead {
  comics: Facet[];
}
