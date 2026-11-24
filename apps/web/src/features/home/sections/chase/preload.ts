import { imageItem, type PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";
import { tetraItems } from "../../actors/tetra/preload";

import { CARD_PICTURES } from "./covers";

/**
 * What the chase and the comic need: the doll, Silverbolt and Tetra (she shares her list with the
 * funny section) and the pictures of the two comics beside her. Her book is made of shapes and loads
 * nothing. The section is far down the page, so all of it is `deferred`: it arrives in the
 * background in the order the visitor reaches it, and the scene shows nothing of an actor that is
 * not here yet. The marks are drawn by a shader and load nothing.
 */
export function preload(): PreloadItem[] {
  return [
    ...dollItems(),
    ...silverboltItems(),
    ...tetraItems(),
    ...Object.values(CARD_PICTURES).map((path) => ({
      ...imageItem(path, "Loading the comic selections"),
      deferred: true,
      priority: 64,
    })),
  ];
}
