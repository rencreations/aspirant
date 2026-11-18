import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { PREVIEWS, stripForWindow } from "./data";

export interface FilmItemOptions {
  /**
   * The trailer is the first thing the strip shows. "waited" (the default) holds the loading bar for
   * it, so the strip opens with the picture moving. "deferred" loads it behind everything else and
   * the plane shows its colour until it arrives.
   */
  trailer?: "waited" | "deferred";
  /** The priority of the deferred trailer. */
  trailerPriority?: number;
  /** The priority of the ten previews (smaller first). They are never waited for: the visitor reaches them later. */
  previewPriority?: number;
}

/**
 * What the film plane needs: its code, the trailer loop in the display's size (held whole in memory
 * and saved in the browser, so the strip opens with it moving) and the ten preview clips (about 2.7
 * MB, deferred: the hold is screens away). Real bytes, no timer. A section puts this list in its own
 * `preload()`. The files go through the media store under the same path strings the actor loads
 * them by, so one download serves both. This file imports no three.js (it is in the bundle of every page).
 */
export function filmItems(options: FilmItemOptions = {}): PreloadItem[] {
  const strip = stripForWindow();
  const trailerDeferred = options.trailer === "deferred";
  const trailer = mediaItem(strip.path, "Loading the trailer", {
    type: "video/mp4",
    bytes: strip.bytes,
  });
  return [
    chunkItem("home-film", "Hanging the film", () => import("./actor"), 1),
    trailerDeferred
      ? { ...trailer, deferred: true, priority: options.trailerPriority ?? 20 }
      : trailer,
    ...PREVIEWS.map((film, i) => ({
      ...mediaItem(film.path, "Loading the previews", {
        type: "video/mp4",
        bytes: film.bytes,
        background: true,
      }),
      deferred: true,
      priority: (options.previewPriority ?? 20) + i * 0.01,
    })),
  ];
}
