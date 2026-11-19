import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { PREVIEWS, TRAILER_FILM } from "./data";
import { warmTrailer } from "./stream";

export interface FilmItemOptions {
  /**
   * The trailer is the first thing the strip shows. "waited" (the default) holds the loading bar for
   * its first seconds, so the strip opens with a real picture moving. "deferred" loads them behind
   * everything else and the plane shows its colour until they arrive.
   */
  trailer?: "waited" | "deferred";
  /** The priority of the deferred trailer. */
  trailerPriority?: number;
  /** The priority of the ten previews (smaller first). They are never waited for: the visitor reaches them later. */
  previewPriority?: number;
}

/**
 * The first seconds of the trailer, buffered in the stream's own element (`stream.ts`): the film is
 * 145 MB, so it is never held whole. The bar moves with the real seconds in hand, turned into the
 * bytes they stand for. The plane takes the same element, so what is buffered here is what plays.
 * One request at a time is the browser's own range request, which the retry rules of the site
 * (`lib/retry.ts`) cover: a stall, a drop or a failure starts it again, for as long as it takes.
 */
function trailerItem(): PreloadItem {
  return {
    id: "stream:home-trailer",
    label: "Loading the trailer",
    weight: Math.max(
      1,
      Math.round((TRAILER_FILM.bytes * TRAILER_FILM.warmSeconds) / TRAILER_FILM.dur / 1_000_000),
    ),
    memo: false,
    run: (report) => warmTrailer(report),
  };
}

/**
 * What the film plane needs: its code, the first seconds of the trailer (streamed, waited for so the
 * strip opens with a real picture) and the ten preview clips (about 15 MB, `deferred`: the hold is
 * screens away, and they download behind everything urgent, in order, so they are in the cache before
 * the orbit). Real bytes, no timer. A section puts this list in its own `preload()`. The previews go
 * through the media store under the same path strings the actor loads them by, so one download serves
 * both. This file imports no three.js (it is in the bundle of every page).
 */
export function filmItems(options: FilmItemOptions = {}): PreloadItem[] {
  const trailerDeferred = options.trailer === "deferred";
  const trailer = trailerItem();
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
