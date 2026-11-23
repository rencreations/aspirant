import { chunkItem, type PreloadItem } from "@/lib/preload";

import { droneItems } from "../../actors/drone/preload";
import { tetraItems } from "../../actors/tetra/preload";
import { marksItems } from "../../fx/comic-marks/preload";

import { bitmapItem } from "./bitmaps";
import { FAN_PICS, artSources, fanSource } from "./pictures";

/**
 * What the bend section needs, all deferred: it is the fourteenth screen of the story, so none of it
 * is shown when the page opens. In the order the visitor reaches it: the section's own code, Tetra
 * (the kite's pictures are left out, she never flies it here), the drone, the fifteen fan pictures
 * of the wall and the ring (2.9 MB), then the ten splash cards of the spiral (the hero's own files,
 * so the browser already has them) and the picture of the drone. The bytes are real: each picture
 * is fetched whole and decoded here, and a card that is reached first shows its colour until its
 * picture has arrived. Tetra and the drone are listed by the sections that show them first as
 * well: an item two lists share is kept once.
 */
export function preload(): PreloadItem[] {
  const later = (priority: number) => ({ deferred: true, priority });
  return [
    {
      ...chunkItem("home-bend", "Hanging the pictures", () => import("./runtime"), 2),
      ...later(62),
    },
    ...tetraItems({ kite: false, priority: 60 }),
    ...droneItems({ priority: 10 }),
    ...marksItems(),
    ...FAN_PICS.map((pic) => bitmapItem(fanSource(pic), "Loading the fan art", later(64))),
    ...artSources().map((src) => bitmapItem(src, "Loading the splash art", later(66))),
  ];
}
