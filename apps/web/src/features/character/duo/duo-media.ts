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
 * What the page needs before it opens (one version only: a slow connection waits for all of it):
 * the splash art and the second picture of the hero, the face of the partner, her full art, the
 * strip of the film, the gallery stills and the posters of the films. All of them show on the page
 * as it is scrolled. Only the voice lines wait, because they play when the visitor presses.
 */
export function duoFirstPaint(who: Who): PreloadItem[] {
  return [
    imageItem(splashPath(who), `Loading ${who === "ruby" ? "Ruby" : "Angela"}`, 3),
    imageItem(layerPath(who), "Loading the second picture", 2),
    imageItem(`/img/char/${PARTNER[who]}/splash-sm.webp`, "Loading her partner", 1),
    imageItem(splashPath(PARTNER[who]), "Loading her partner", 1),
    ...FRAMES.slice(0, FRAME_SECONDS[who].length).map((n) =>
      imageItem(framePath(who, n), "Loading the film strip", 1),
    ),
    ...STILLS.map((p) => imageItem(p, "Loading the gallery", 1)),
    imageItem(`/video/ruby-angela/${who}.jpg`, "Loading the film", 1),
    imageItem("/video/ruby-angela/trailer.jpg", "Loading the trailer", 1),
  ];
}

/**
 * The rest, deferred (the loading bar does not wait for it): the voice lines, which play when the
 * visitor presses a button that shows its loading state until its line is in. The films stream when
 * they are played.
 */
export function duoLater(who: Who): Array<{ priority: number; items: PreloadItem[] }> {
  return [
    {
      priority: 20,
      items: Array.from({ length: VOICE_COUNT }, (_, i) =>
        savedItem(voicePath(who, i + 1), "Loading her voice lines", 1),
      ),
    },
  ];
}
