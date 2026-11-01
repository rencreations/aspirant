import { getCharacter } from "@/content/characters";
import { imageItem, savedItem, type PreloadItem } from "@/lib/preload";

import { FILMS, HERO, PARTNER, type Who } from "./media";

/**
 * What a page of the pair needs before it opens (one version only: a slow connection waits for all
 * of it): her splash art, the album art for the nav, the posters of the films and her partner's art.
 */
export function lcFirstPaint(who: Who): PreloadItem[] {
  return [
    imageItem(HERO[who].src, `Loading ${getCharacter(who).name}`, 3),
    imageItem(`/img/char/${who}/splash-sm.webp`, "Loading the album art", 1),
    ...Object.values(FILMS).map((f) => imageItem(f.poster, "Loading the films", 1)),
    imageItem(HERO[PARTNER[who]].src, "Loading her partner", 1),
  ];
}

/**
 * The rest, deferred: the loading bar does not wait for it. The voice lines play when the visitor
 * presses a button, which shows its loading state until its line is in. The films stream when they
 * are played.
 */
export function lcLater(who: Who): Array<{ priority: number; items: PreloadItem[] }> {
  const lines = getCharacter(who).voice;
  return [
    {
      priority: 20,
      items: lines.map((l) => savedItem(`/${l.file}`, "Loading her voice lines", 1)),
    },
  ];
}
