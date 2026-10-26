import { getCharacter } from "@/content/characters";
import { imageItem, savedItem, type PreloadItem } from "@/lib/preload";

import { FILMS, HERO, PARTNER, type Who } from "./media";

/** What a page of the pair needs before it opens: her splash art and the album art for the nav. */
export function lcFirstPaint(who: Who): PreloadItem[] {
  return [
    imageItem(HERO[who].src, `Loading ${getCharacter(who).name}`, 3),
    imageItem(`/img/char/${who}/splash-sm.webp`, "Loading the album art", 1),
  ];
}

/**
 * The rest, deferred: the loading bar does not wait for it. The voice lines, the posters of the
 * films and her partner's art arrive in the background. The films stream when they are played.
 */
export function lcLater(who: Who): Array<{ priority: number; items: PreloadItem[] }> {
  const lines = getCharacter(who).voice;
  return [
    {
      priority: 20,
      items: lines.map((l) => savedItem(`/${l.file}`, "Loading her voice lines", 1)),
    },
    {
      priority: 28,
      items: Object.values(FILMS).map((f) => imageItem(f.poster, "Loading the films", 1)),
    },
    {
      priority: 30,
      items: [imageItem(HERO[PARTNER[who]].src, "Loading her partner", 1)],
    },
  ];
}
