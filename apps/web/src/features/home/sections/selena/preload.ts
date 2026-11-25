import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { preloadSelenaCast } from "../vp";
import { selenaItems } from "../../actors/selena/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";

/**
 * The section is about thirty screens down, but it is Selena's room, and the list shows her on the way:
 * its code, Selena with her clips and cameras, the dragon and the room's glass are all WAITED for, so
 * they are in place when the visitor gets here, however fast the scroll. The doll (the fall) stays
 * deferred. The drawer is CSS and needs no file. The comic marks are code in the engine chunk.
 */
export function preload(): PreloadItem[] {
  return [
    // Waited for with her files (the owner, 24 Nov 2026): the list shows her from far above, and a
    // visitor who scrolls fast must find the room, her model, her clips and the dragon in place.
    chunkItem("home-selena", "Opening the room", () => import("./runtime"), 1),
    ...(preloadSelenaCast() ? selenaItems({ deferred: false }) : []),
    ...(preloadSelenaCast() ? silverboltItems({ deferred: false }) : []),
    imageItem("/img/home/selena-glass.webp", "Loading the room"),
    ...dollItems({ priority: 37 }),
  ];
}
