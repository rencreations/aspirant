import { characters } from "@/content/characters";
import { imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { portraitFor } from "../reader/portraits";
import { HERO_BYTES, HERO_POSTER, HERO_VIDEO } from "./media";

/**
 * What the story page needs before it opens: the film behind the title and its still (the film is
 * on the first screen and plays by itself, so it is waited for, whole). The pictures of the
 * characters are far down the page and wait in the background.
 */
export function storyLandingItems(): PreloadItem[] {
  return [
    imageItem(HERO_POSTER, "Loading the story film", 1),
    mediaItem(HERO_VIDEO, "Loading the story film", {
      type: "video/mp4",
      bytes: HERO_BYTES,
    }),
    ...characters.flatMap((c) => {
      const art = portraitFor(c.slug);
      return art
        ? [{ ...imageItem(art.src, "Loading the characters", 1), deferred: true, priority: 20 }]
        : [];
    }),
  ];
}
