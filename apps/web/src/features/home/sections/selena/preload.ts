import { chunkItem, type PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { selenaItems } from "../../actors/selena/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";

/**
 * The section is about thirty screens down, so nothing here holds the first screen. Its code, then
 * the actors it uses, each under the priority the sections before it gave them (the aggregate keeps
 * one copy of an item two sections ask for): Selena and her cameras (the list's tenth frame), the
 * dragon (the bolt section) and the doll (the fall). Until they arrive the section is built and shows
 * the sky and the drawer with its words, a calm empty room. The sky, the stars and the drawer are
 * CSS and need no file. The comic marks are code in the engine chunk.
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-selena", "Opening the room", () => import("./runtime"), 1),
      deferred: true,
      priority: 47,
    },
    ...selenaItems({ priority: 40 }),
    ...silverboltItems({ priority: 36 }),
    ...dollItems({ priority: 37 }),
  ];
}
