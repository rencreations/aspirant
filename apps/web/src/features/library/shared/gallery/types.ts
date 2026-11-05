/**
 * What the shared gallery needs to know about a picture. A room's own item (an art, a fan piece,
 * a poster) fits this shape when it has an `img` and a `title`, so it can be passed as it is:
 *
 *   <Gallery items={arts} ... />          // arts: ArtItem[], each with `img: LibImage`
 *
 * See `index.ts` for how the pieces fit together.
 */
import type { Slug, PairId } from "@/content/types";

import type { Canon, Credit, LibImage } from "../../types";

/** A file the visitor can take away: a library key, the name to save it as, its size if known. */
export interface Download {
  key: string;
  name: string;
  bytes?: number;
}

export interface GalleryItem {
  /** Stable id. It is what `?i=` holds, so keep it the same between builds. */
  id: string;
  title: string;
  /** Spoken description. The title is used when it is missing. */
  alt?: string;
  img: LibImage;
  chars?: readonly Slug[];
  pair?: PairId | null;
  canon?: Canon;
  credit?: Credit;
  /** One sentence for the info panel. */
  note?: string;
  /** Extra rows for the info panel, as [label, value], for example ["Kind", "Splash art"]. */
  facts?: ReadonlyArray<readonly [string, string]>;
  /** The original file, for the download button. The full size picture is offered when missing. */
  download?: Download;
  /** A link to a related place (the film a still comes from), shown in the info panel. */
  link?: { href: string; label: string };
}
