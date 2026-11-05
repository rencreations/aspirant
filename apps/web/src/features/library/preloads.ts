import type { PreloadItem } from "@/lib/preload";

import { items as artsItems } from "./arts/preload";
import { items as filmsItems } from "./films/preload";
import { items as musicItems } from "./music/preload";
import { items as voicelinesItems } from "./voicelines/preload";
import { items as fanartItems } from "./fanart/preload";
import { items as comicItems } from "./comic/preload";
import { items as loreItems } from "./lore/preload";
import { items as designItems } from "./design/preload";
import { items as animationItems } from "./animation/preload";
import { items as othersItems } from "./others/preload";
import { shelfItems } from "./shelf/preload";
import { isCollectionSlug, type CollectionSlug } from "./types";

const BY_SLUG: Record<CollectionSlug, () => PreloadItem[]> = {
  arts: artsItems,
  films: filmsItems,
  music: musicItems,
  voicelines: voicelinesItems,
  fanart: fanartItems,
  comic: comicItems,
  lore: loreItems,
  design: designItems,
  animation: animationItems,
  others: othersItems,
};

/** The loading list of `/collection/<slug>`. Each room owns its own `preload.ts`. */
export function libraryPageItems(slug: string): PreloadItem[] {
  return isCollectionSlug(slug) ? BY_SLUG[slug]() : [];
}

/** The loading list of `/collection`, the shelf. */
export { shelfItems };
