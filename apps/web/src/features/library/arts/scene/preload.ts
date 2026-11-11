import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../../data";
import { flowFirstScreen } from "../core/flow/first-screen";
import { sceneFacetOf, sceneFacets, sceneSearchOf } from "./facets";

/**
 * What the first screen of Scene needs: the data file, the room's code and the thumbnails of the
 * first rows (the screen, the search and the filter in the address decide which). Every other
 * picture loads when its row comes near.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-scene"),
    chunkItem("library-arts-scene", "Opening the room", () => import("./page"), 2),
    flowFirstScreen({
      id: "library-arts-scene-first",
      room: "scene",
      label: "Loading the first scenes",
      facetOf: sceneFacetOf,
      searchOf: sceneSearchOf,
      facets: sceneFacets,
    }),
  ];
}
