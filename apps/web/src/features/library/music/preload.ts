import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../data";
import { discFacesItem } from "./faces";

/**
 * What the music room needs on first paint: its data, its code (one chunk: the room, the disc
 * scene and three.js) and the faces of the seven discs, which all come round as the field turns.
 * The type is in the shared list (`fontsItem`). The songs are fetched when a disc is
 * played.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("music"),
    chunkItem("library-music", "Opening the music room", () => import("./page"), 4),
    discFacesItem(),
  ];
}
