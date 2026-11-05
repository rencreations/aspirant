import type { Download } from "../shared/gallery";
import type { ItemBase, LibImage } from "../types";

/** What an official picture is: a character's splash art, art of a pair, a lore card, or other official art. */
export type ArtKind = "splash" | "pair" | "lore" | "official";

export const ART_KINDS: readonly ArtKind[] = ["splash", "pair", "lore", "official"];

/** The words on the kind chips. */
export const KIND_LABELS: Readonly<Record<ArtKind, string>> = {
  splash: "Splash art",
  pair: "Pair art",
  lore: "Lore cards",
  official: "Other official",
};

/**
 * One official picture of `public/data/library/arts.json` (made by `scripts/library/arts/official.py`).
 * It has everything the shared gallery needs (`id`, `title`, `img`, `alt` and the rest), so the
 * gallery and the lightbox take it as it is.
 */
export interface ArtItem extends ItemBase {
  collection: "arts";
  kind: ArtKind;
  alt: string;
  img: LibImage;
  note?: string;
  /** The untouched original file. */
  download: Download;
}

/** The data file of the scene stills (the other half of the room). Only the count is read here. */
export interface ScenesFileHead {
  items: readonly unknown[];
}

/** The data file of the scene stills (a path in `public/`). It belongs to the other tab and is only counted and warmed here. */
export const SCENES_DATA = "/data/library/arts-scenes.json";
