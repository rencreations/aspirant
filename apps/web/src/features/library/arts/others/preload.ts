import { chunkItem, type PreloadItem } from "@/lib/preload";

import { libraryDataItem } from "../../data";
import { flowFirstScreen } from "../core/flow/first-screen";
import { ASPIRANT_SECTIONS } from "../core/flow/sections";
import {
  othersFacetOf,
  othersFacets,
  othersSearchOf,
  type OthersHead,
  type OthersItem,
} from "./facets";

/**
 * What the first screen of Others needs: the data file, the room's code and the thumbnails of the
 * first rows (the screen, the search and the filter in the address decide which). Every other
 * picture loads when its row comes near.
 */
export function items(): PreloadItem[] {
  return [
    libraryDataItem("arts-others"),
    chunkItem("library-arts-others", "Opening the room", () => import("./page"), 2),
    flowFirstScreen<OthersItem, OthersHead>({
      id: "library-arts-others-first",
      room: "others",
      label: "Loading the first pictures",
      facetOf: othersFacetOf,
      searchOf: othersSearchOf,
      facets: othersFacets,
      sections: ASPIRANT_SECTIONS,
    }),
  ];
}
