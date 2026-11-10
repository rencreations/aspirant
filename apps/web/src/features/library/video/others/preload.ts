import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../../data";
import type { OthersFile } from "./types";
import { findVideo, firstScreenKeys, restKeys, stripKeys } from "./video-data";

/** Fetch library pictures into the browser cache, reporting how many have arrived. */
function pictures(
  id: string,
  label: string,
  pick: (file: OthersFile) => string[],
  options: { weight: number; deferred?: boolean; priority?: number },
): PreloadItem {
  return {
    id,
    label,
    weight: options.weight,
    deferred: options.deferred,
    priority: options.priority,
    run: async (report, context) => {
      const file = await fetchLibraryJson<OthersFile>(libraryDataPath("video-others"));
      const keys = pick(file);
      let done = 0;
      await Promise.all(
        keys.map(async (key) => {
          await imageItem(libUrl(key), label).run(() => undefined, context);
          done += 1;
          report(done / keys.length);
        }),
      );
    },
  };
}

/** The video named in the address (`?i=<id>`), whose poster the viewer shows first. */
function linkedId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("i") ?? "";
}

/**
 * What the Others room needs on first paint: its data file, its code, the thumbnails of the first
 * shelves and of the header, and the poster of the video in the address. Every other thumbnail and
 * every hover strip is deferred and keeps loading in the background. The videos themselves are never
 * loaded ahead: they stream when the visitor presses play.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("video-others"),
    chunkItem("library-video-others", "Opening the video wall", () => import("./page"), 2),
    pictures(
      "library-video-others-first",
      "Loading the first videos",
      (file) => firstScreenKeys(file.items, findVideo(file.items, linkedId())),
      { weight: 4 },
    ),
    pictures(
      "library-video-others-rest",
      "Loading the other thumbnails",
      (file) => restKeys(file.items, findVideo(file.items, linkedId())),
      { weight: 1, deferred: true, priority: 30 },
    ),
    pictures(
      "library-video-others-strips",
      "Warming the previews",
      (file) => stripKeys(file.items),
      {
        weight: 1,
        deferred: true,
        priority: 70,
      },
    ),
  ];
}
