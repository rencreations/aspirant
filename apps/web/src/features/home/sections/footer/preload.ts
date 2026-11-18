import { chunkItem, type PreloadItem } from "@/lib/preload";

import { droneItems } from "../../actors/drone/preload";

/** The footer is the last screen of the story: it comes after the archive's files. */
const PRIORITY = 74;

/**
 * What the footer needs, all deferred: its own code (the drone's flight and the way out) and the
 * drone, which the earlier sections list too (an item two lists share is kept once). The card, the
 * links and the button are the page's own HTML and need no loading.
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-footer", "Setting up the footer", () => import("./runtime"), 1),
      deferred: true,
      priority: PRIORITY,
    },
    ...droneItems({ priority: 10 }),
  ];
}
