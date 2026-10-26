import { imageItem, savedItem, type PreloadItem } from "@/lib/preload";

import { FRAME_SECONDS, PARTNER, type Who } from "./duo-data";

const FRAME_COUNT = 8;

/** The two pictures of the hero: the splash art, and the second picture (see `scripts/ruby-angela/build.py`). */
export const splashPath = (who: Who) => `/img/char/${who}/splash.webp`;
export const layerPath = (who: Who) => `/img/ruby-angela/${who}/layer.webp`;
export const framePath = (who: Who, n: number) =>
  `/img/ruby-angela/${who}/frame-${String(n).padStart(2, "0")}.webp`;

/** Stills of the trailer that the site already holds (1280 by 540). */
export const STILLS = [1, 2, 3].map(
  (n) => `/img/hero-stills/ruby-angela-${String(n).padStart(2, "0")}.webp`,
);

export const FRAMES = Array.from({ length: FRAME_COUNT }, (_, i) => i + 1);

/** Number of voice lines of each (`audio/voice/<slug>/NN.m4a`). */
const VOICE_COUNT = 40;
export const voicePath = (who: Who, n: number) =>
  `/audio/voice/${who}/${String(n).padStart(2, "0")}.m4a`;

/**
 * What the page needs before it opens: the splash art and the second picture of the hero, and the
 * face of the partner (the Duet's portrait is a crop of the same art, so it is warm by then).
 */
export function duoFirstPaint(who: Who): PreloadItem[] {
  return [
    imageItem(splashPath(who), `Loading ${who === "ruby" ? "Ruby" : "Angela"}`, 3),
    imageItem(layerPath(who), "Loading the second picture", 2),
    imageItem(`/img/char/${PARTNER[who]}/splash-sm.webp`, "Loading her partner", 1),
  ];
}

/**
 * Everything else, in the order the page gets to it. Each group is deferred (the loading bar does
 * not wait for it): the strip of the film, the posters and the voice lines. The films stream when
 * they are played.
 */
export function duoLater(who: Who): Array<{ priority: number; items: PreloadItem[] }> {
  return [
    {
      priority: 10,
      items: [
        imageItem(splashPath(PARTNER[who]), "Loading her partner", 1),
        ...FRAMES.slice(0, FRAME_SECONDS[who].length).map((n) =>
          imageItem(framePath(who, n), "Loading the film strip", 1),
        ),
      ],
    },
    {
      priority: 20,
      items: Array.from({ length: VOICE_COUNT }, (_, i) =>
        savedItem(voicePath(who, i + 1), "Loading her voice lines", 1),
      ),
    },
    {
      priority: 30,
      items: [
        ...STILLS.map((p) => imageItem(p, "Loading the gallery", 1)),
        imageItem(`/video/ruby-angela/${who}.jpg`, "Loading the film", 1),
        imageItem("/video/ruby-angela/trailer.jpg", "Loading the trailer", 1),
      ],
    },
  ];
}
