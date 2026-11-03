import { characters } from "@/content/characters";
import { chapters } from "@/content/story";
import { imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { portraitFor } from "../reader/portraits";
import { HERO_BYTES, HERO_POSTER, HERO_VIDEO } from "./media";

/** The first row of preview cards sits just under the fold of the first screen. */
const FIRST_CARDS = 6;

/**
 * What the story page needs before it opens: the film behind the title and its still (the film is
 * on the first screen and plays by itself, so it is waited for, whole) and the pictures of the
 * first chapter cards, which the join brings up from below. The rest of the previews and the
 * pictures of the characters are far down the page and wait in the background.
 */
export function storyLandingItems(): PreloadItem[] {
  return [
    imageItem(HERO_POSTER, "Loading the story film", 1),
    mediaItem(HERO_VIDEO, "Loading the story film", {
      type: "video/mp4",
      bytes: HERO_BYTES,
    }),
    ...chapters.map((c, i) => {
      const item = imageItem(`/${c.thumb}`, "Loading the chapters", 1);
      return i < FIRST_CARDS ? item : { ...item, deferred: true, priority: 10 };
    }),
    ...characters.flatMap((c) => {
      const art = portraitFor(c.slug);
      return art
        ? [{ ...imageItem(art.src, "Loading the characters", 1), deferred: true, priority: 20 }]
        : [];
    }),
  ];
}
