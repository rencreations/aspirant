import { getCharacter } from "@/content/characters";
import { imageItem, mediaItem, savedItem, type PreloadItem } from "@/lib/preload";

import { FILMS, HERO, MUSIC, officialArt, type Who } from "./media";

/**
 * What a page of the pair needs before it opens: her picture, the album art for the nav, the
 * posters of the first films and the music.
 */
export function lfFirstPaint(who: Who): PreloadItem[] {
  return [
    imageItem(HERO[who].src, `Loading ${getCharacter(who).name}`, 3),
    imageItem(`/img/char/${who}/splash-sm.webp`, "Loading the album art", 1),
    imageItem(FILMS.trailer.poster, "Loading the films", 1),
    imageItem(FILMS.skin.poster, "Loading the films", 1),
    mediaItem(MUSIC, "Loading the music", { type: "audio/mp4", weight: 3, timeoutMs: 120_000 }),
  ];
}

/**
 * The rest, deferred: the loading bar does not wait for it. The voice lines and the pictures of
 * the gallery arrive in the background. The films stream when they are played, so only their
 * posters are fetched here.
 */
export function lfLater(who: Who): Array<{ priority: number; items: PreloadItem[] }> {
  const lines = getCharacter(who).voice;
  return [
    {
      priority: 20,
      items: lines.map((l) => savedItem(`/${l.file}`, "Loading her voice lines", 1)),
    },
    {
      priority: 28,
      items: [FILMS.short, FILMS.music, FILMS.musicBts, FILMS.producer, FILMS.idea].map((f) =>
        imageItem(f.poster, "Loading the films", 1),
      ),
    },
    {
      priority: 30,
      items: [
        ...officialArt(who).map((a) => imageItem(a.src, "Loading the art", 1)),
        imageItem(HERO[who === "layla" ? "fanny" : "layla"].src, "Loading her partner", 1),
      ],
    },
  ];
}
