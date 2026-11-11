import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../../data";
import { flowFirstScreen } from "../core/flow/first-screen";
import { gameFacetOf, gameFacets, gameSearchOf } from "./facets";

/**
 * What the first screen of Game needs: the data file, the room's code and the thumbnails of the
 * first rows (the screen, the search and the filter in the address decide which). Every other
 * picture loads when its row comes near.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-game"),
    chunkItem("library-arts-game", "Opening the room", () => import("./page"), 2),
    flowFirstScreen({
      id: "library-arts-game-first",
      room: "game",
      label: "Loading the first games",
      facetOf: gameFacetOf,
      searchOf: gameSearchOf,
      facets: gameFacets,
    }),
  ];
}
