import { chunkItem, type PreloadItem } from "@/lib/preload";

import { buddiesItems } from "../../actors/buddies/preload";
import { duoItems } from "../../actors/duo/preload";

/**
 * The descent is about ten screens down, so nothing here holds the first screen. The code of the
 * section comes first; the pair's own files (the doll, the model of the drone, the faces) are the
 * pair's list (`actors/buddies/preload.ts`: the drone's and the doll's), deferred, in the order the
 * scroll reaches them. If the visitor gets here first the section is built at once, and the pair
 * join when the media store has their files.
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-descent", "Loading the descent", () => import("./runtime"), 1),
      deferred: true,
      priority: 30,
    },
    ...buddiesItems({ priority: 31 }),
    // The two Guinevere drones that join the pair at 20 percent of the descent (round nine).
    ...duoItems({ priority: 32 }),
  ];
}
