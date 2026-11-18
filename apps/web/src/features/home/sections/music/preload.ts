import { chunkItem, type PreloadItem } from "@/lib/preload";

import { duoItems } from "../../actors/duo/preload";
import { gramophoneItems } from "../../actors/gramophone/preload";
import { recordsItems } from "../../actors/records/preload";

/**
 * What the music section needs, all of it in the background: the pair (shared with the voices and
 * the funny sections), the section's code, the gramophone with its three maps (0.79 MB) and the
 * crate with the covers of the seven records (about 0.5 MB). The songs are not here: a song is
 * streamed when the visitor picks it (about 2 MB each), so a visitor who never picks one costs
 * nothing. Until the gramophone and the covers have arrived the section shows its waiting line,
 * never a different scene.
 */
const PRIORITY = 42;

export function preload(): PreloadItem[] {
  return [
    ...duoItems(),
    {
      ...chunkItem("home-music", "Preparing the music", () => import("./runtime")),
      deferred: true,
      priority: PRIORITY,
    },
    ...gramophoneItems({ priority: PRIORITY + 0.2 }),
    ...recordsItems({ count: 10, priority: PRIORITY + 0.4 }),
  ];
}
