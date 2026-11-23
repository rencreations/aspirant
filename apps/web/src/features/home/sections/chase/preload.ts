import { imageItem, type PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";
import { tetraItems } from "../../actors/tetra/preload";

import { CARD_PICTURES, coverItem } from "./covers";

/**
 * What the chase and the comic need: the doll, Silverbolt and Tetra (the kite pictures too, she
 * shares her list with the funny section), and the two covers of her book. The section is far down
 * the page, so all of it is `deferred`: it arrives in the background in the order the visitor reaches
 * it, and the scene shows nothing of an actor that is not here yet (the book keeps its plain covers
 * until its pictures arrive). The marks are drawn by a shader and load nothing.
 */
export function preload(): PreloadItem[] {
  return [
    ...dollItems(),
    ...silverboltItems(),
    ...tetraItems(),
    coverItem(),
    ...Object.values(CARD_PICTURES).map((path) => ({
      ...imageItem(path, "Loading the comic selections"),
      deferred: true,
      priority: 64,
    })),
  ];
}
