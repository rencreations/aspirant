import { chunkItem, type PreloadItem } from "@/lib/preload";

import { dollItems } from "../../actors/doll/preload";
import { handItems } from "../../actors/hand/preload";

/**
 * The hand section is far down the page (about 18 screens), so its files are deferred, in the order
 * the scroll reaches them: the code of the section (the words, and the carry that drives the hand and
 * the doll for this section and the list), the doll (1.1 MB), the hand (273 KB). The bar does not
 * wait for them. If the visitor gets here first, the section is built at once and shows its words,
 * and the actors join when the media store has them. The comic marks need no file.
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-hand", "Loading the hand", () => import("./runtime"), 1),
      deferred: true,
      priority: 30,
    },
    ...dollItems({ priority: 31 }),
    ...handItems({ priority: 32 }),
  ];
}
