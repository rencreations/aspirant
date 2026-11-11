import type { PreloadItem } from "@/lib/preload";

import { items as splashItems } from "./arts/splash/preload";
import { items as sceneItems } from "./arts/scene/preload";
import { items as artsComicItems } from "./arts/comic/preload";
import { items as gameItems } from "./arts/game/preload";
import { items as artsDesignItems } from "./arts/design/preload";
import { items as artsOthersItems } from "./arts/others/preload";
import { items as artsFanartItems } from "./arts/fanart/preload";
import { items as cosplayItems } from "./arts/cosplay/preload";
import { artsRoomOfPath } from "./arts/core/routes";
import { items as modelsItems } from "./models/preload";
import { items as videoFilmsItems } from "./video/films/preload";
import { items as videoOthersItems } from "./video/others/preload";
import { items as musicItems } from "./music/preload";
import { items as voicelinesItems } from "./voicelines/preload";
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
  arts: splashItems,
  video: videoChooserItems,
  music: musicItems,
  voicelines: voicelinesItems,
  models: modelsItems,
  comic: comicItems,
  lore: loreItems,
  design: designItems,
  animation: animationItems,
  others: othersItems,
};

/** The loading list of an Arts room: `arts` (Splash art), `arts/scene`, `arts/cosplay`, `arts/cosplay/<slug>`. */
function artsRoomItems(path: string): PreloadItem[] {
  const found = artsRoomOfPath(path);
  if (!found) return [];
  switch (found.room) {
    case "splash":
      return splashItems();
    case "scene":
      return sceneItems();
    case "comic":
      return artsComicItems();
    case "game":
      return gameItems();
    case "design":
      return artsDesignItems();
    case "others":
      return artsOthersItems();
    case "fanart":
      return artsFanartItems();
    case "cosplay":
      return cosplayItems(found.character);
  }
}

/**
 * The loading list of `/collection/<path>`. `path` is the part of the route after `/collection/`
 * (`music`, `video/films`). Each room owns its own `preload.ts`.
 */
export function libraryPageItems(path: string): PreloadItem[] {
  const [slug = "", room] = path.replace(/^\/+|\/+$/gu, "").split("/");
  if (slug === "animation" && room) return animationCharacterItems(room);
  if (slug === "video" && room === "films") return videoFilmsItems();
  if (slug === "video" && room === "others") return videoOthersItems();
  if (slug === "arts") return artsRoomItems(path);
  return isCollectionSlug(slug) ? BY_SLUG[slug]() : [];
}

/** The loading list of `/collection`, the shelf. */
export { shelfItems };
