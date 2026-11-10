import type { PreloadItem } from "@/lib/preload";

import { items as artsItems } from "./arts/preload";
import { items as videoFilmsItems } from "./video/films/preload";
import { items as videoOthersItems } from "./video/others/preload";
import { items as musicItems } from "./music/preload";
import { items as voicelinesItems } from "./voicelines/preload";
import { items as fanartItems } from "./fanart/preload";
import { items as comicItems } from "./comic/preload";
import { items as loreItems } from "./lore/preload";
import { items as designItems } from "./design/preload";
import {
  characterItems as animationCharacterItems,
  items as animationItems,
} from "./animation/preload";
import { items as othersItems } from "./others/preload";
import { shelfItems, videoChooserItems } from "./shelf/preload";
import { isCollectionSlug, type CollectionSlug } from "./types";

const BY_SLUG: Record<CollectionSlug, () => PreloadItem[]> = {
  arts: artsItems,
  video: videoChooserItems,
  music: musicItems,
  voicelines: voicelinesItems,
  fanart: fanartItems,
  comic: comicItems,
  lore: loreItems,
  design: designItems,
  animation: animationItems,
  others: othersItems,
};

/**
 * The loading list of `/collection/<path>`. `path` is the part of the route after `/collection/`
 * (`music`, `video/films`). Each room owns its own `preload.ts`.
 */
export function libraryPageItems(path: string): PreloadItem[] {
  const [slug = "", room] = path.replace(/^\/+|\/+$/gu, "").split("/");
  if (slug === "animation" && room) return animationCharacterItems(room);
  if (slug === "video" && room === "films") return videoFilmsItems();
  if (slug === "video" && room === "others") return videoOthersItems();
  return isCollectionSlug(slug) ? BY_SLUG[slug]() : [];
}

/** The loading list of `/collection`, the shelf. */
export { shelfItems };
