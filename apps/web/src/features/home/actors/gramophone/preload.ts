import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { GR_MODEL, GR_MODEL_BYTES } from "./facts";

/**
 * What the gramophone needs: its script (the actor, one lazy chunk) and one file, the model with its
 * three maps (0.79 MB). The crank, the platter and the tonearm are code. The actor loads the same
 * path through the same media store, so the bytes the loading list fetched are the bytes it parses,
 * and a visit that never ran this list still works.
 *
 * The music section is far down the page, so the default is `deferred` (it keeps downloading behind
 * the urgent items). Pass `deferred: false` where a page waits for it.
 */
export function gramophoneItems(
  options: { deferred?: boolean; priority?: number } = {},
): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 45;
  const items: PreloadItem[] = [
    chunkItem("home-gramophone", "Winding up the gramophone", () => import("./index")),
    mediaItem(GR_MODEL, "Winding up the gramophone", {
      type: "model/gltf-binary",
      bytes: GR_MODEL_BYTES,
    }),
  ];
  return deferred ? items.map((item) => ({ ...item, deferred: true, priority })) : items;
}
