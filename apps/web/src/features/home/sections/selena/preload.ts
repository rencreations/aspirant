import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { preloadSelenaCast } from "../vp";
import { selenaItems } from "../../actors/selena/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";

/**
 * The section is about thirty screens down, so nothing here holds the first screen. Its code, then
 * the actors it uses, each under the priority the sections before it gave them (the aggregate keeps
 * one copy of an item two sections ask for): Selena and her cameras (the list's tenth frame), the
 * dragon (the bolt section) and the doll (the fall). Until they arrive the section is built and shows
 * the drawer with its words on the plain ground, a calm empty room. The drawer is CSS and needs no
 * file. The comic marks are code in the engine chunk.
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-selena", "Opening the room", () => import("./runtime"), 1),
      deferred: true,
      priority: 47,
    },
    ...(preloadSelenaCast() ? selenaItems({ priority: 40 }) : []),
    ...(preloadSelenaCast() ? silverboltItems({ priority: 36 }) : []),
    {
      ...imageItem("/img/home/selena-glass.webp", "Loading the room"),
      deferred: true,
      priority: 40,
    },
    ...dollItems({ priority: 37 }),
  ];
}
