import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { TETRA_MODEL, TETRA_MODEL_BYTES } from "./model";

/**
 * What Tetra needs: her script (the actor and its props, one lazy chunk) and the model she shares
 * with `/about` (574 KB, the same file and the same saved copy). The book, the poses and the
 * blends are code and shapes: nothing else is fetched. The actor loads the same path through the
 * same media store, so the bytes the loading list fetched are the bytes it parses, and a visit that
 * never ran this list still works.
 *
 * A section decides whether the first screen waits for her: pass `deferred: false` where she is in
 * view when the page opens, and leave the default where she appears further down (she then keeps
 * downloading behind the urgent items).
 */
export function tetraItems(options: { deferred?: boolean; priority?: number } = {}): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 60;
  const items: PreloadItem[] = [
    chunkItem("home-tetra", "Waking Tetra", () => import("./index")),
    mediaItem(TETRA_MODEL, "Waking Tetra", { type: "model/gltf-binary", bytes: TETRA_MODEL_BYTES }),
  ];
  return deferred ? items.map((item) => ({ ...item, deferred: true, priority })) : items;
}
