import type { Route } from "next";

import { COLLECTIONS } from "../registry";
import type { CollectionSlug } from "../types";
import { FILM_IDS } from "../video/links";
import { ARTS_PARTS, ARTS_SLUG, ARTS_UNITS, artsPartCounts } from "./arts-parts";
import { VIDEO_HALVES, VIDEO_SLUG, halfCounts } from "./video-halves";

/** What every part of a split cover says about itself (the shelf draws `index` and `name` on its picture). */
interface SplitPart {
  /** Short key of the part: `films`, `official`. Goes in the data attributes. */
  id: string;
  index: string;
  name: string;
  line: string;
  colour: string;
  /** Key of the 1024 square picture. */
  cover: string;
  href: Route;
}

/** The library index as the shelf reads it. */
export interface LibraryIndex {
  counts?: Record<string, number>;
  /** Items in each room of a collection that has more than one (`video/films`, `arts/fanart`). */
  rooms?: Record<string, number>;
}

/**
 * A shelf cover that opens into rooms instead of leading to one: the data the scene needs, so a
 * third one is a new entry here and nothing else. `fold` says how the cover opens: `gatefold` is two
 * parts (a front panel on a hinge over a back panel), `triptych` is three (a Z fold).
 */
export interface SplitSpec {
  slug: CollectionSlug;
  fold: "gatefold" | "triptych";
  parts: readonly SplitPart[];
  /**
   * A plain page at the cover's own address leads to the parts (`/collection/video`). Without one
   * (Arts: `/collection/arts` is a room) the plain list of the shelf links the parts itself.
   */
  chooser: boolean;
  /** What a screen reader hears once it is open. */
  label: string;
  /** The tone of the rule over the part under the pointer. */
  accent: string;
  /** The count words under each part, from the library index ("12 films"), or "" when unknown. */
  counts: (index: LibraryIndex) => string[];
}

/** Where the cover is on the shelf (0 to 9). */
export function splitIndexOf(spec: SplitSpec): number {
  return Math.max(
    0,
    COLLECTIONS.findIndex((c) => c.slug === spec.slug),
  );
}

const say = (n: number | undefined, unit: string): string =>
  n === undefined ? "" : `${n.toLocaleString("en-US")} ${unit}`;

export const ARTS_SPLIT: SplitSpec = {
  slug: ARTS_SLUG,
  fold: "triptych",
  chooser: false,
  parts: ARTS_PARTS.map((p) => ({ ...p, id: p.room })),
  label: "Arts is open: Official, Fanart and Cosplay.",
  accent: "#e0245e",
  counts: (index) => artsPartCounts(index.rooms).map((n, k) => say(n, ARTS_UNITS[k] ?? "")),
};

export const VIDEO_SPLIT: SplitSpec = {
  slug: VIDEO_SLUG,
  fold: "gatefold",
  chooser: true,
  parts: VIDEO_HALVES.map((h) => ({ ...h, id: h.room })),
  label: "Video is open: Films and Others.",
  accent: "#2a5bff",
  counts: (index) => {
    const [films, others] = halfCounts(index.counts?.[VIDEO_SLUG], FILM_IDS.length, {
      films: index.rooms?.["video/films"],
      others: index.rooms?.["video/others"],
    });
    return [say(films, "films"), say(others, "videos")];
  },
};

/** Every cover that opens, in shelf order. */
export const SPLITS: readonly SplitSpec[] = [ARTS_SPLIT, VIDEO_SPLIT];

export function splitOf(slug: string | null | undefined): SplitSpec | undefined {
  return SPLITS.find((s) => s.slug === slug);
}

/** How many parts a spec has: the engine folds two or three. */
export function partCount(spec: SplitSpec): 2 | 3 {
  return spec.parts.length >= 3 ? 3 : 2;
}
