import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import {
  KITE,
  KITE_BOWS,
  KITE_BOWS_BYTES,
  KITE_BYTES,
  TETRA_MODEL,
  TETRA_MODEL_BYTES,
} from "./model";

/**
 * What Tetra needs: her script (the actor and its props, one lazy chunk), the model she shares with
 * `/about` (574 KB, the same file and the same saved copy), and the kite: the sail's picture (69 KB)
 * and the strip of bows (6 KB). The reel, the rope, the book and the poses are code. The actor loads
 * the same paths through the same media store, so the bytes the loading list fetched are the bytes
 * it parses, and a visit that never ran this list still works. The kite's pictures are left out with
 * `kite: false` for a section that never shows the kite (the bend section).
 *
 * A section decides whether the first screen waits for her: pass `deferred: false` where she is in
 * view when the page opens, and leave the default where she appears further down (she then keeps
 * downloading behind the urgent items).
 */
export function tetraItems(
  options: { deferred?: boolean; priority?: number; kite?: boolean } = {},
): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 60;
  const items: PreloadItem[] = [
    chunkItem("home-tetra", "Waking Tetra", () => import("./index")),
    mediaItem(TETRA_MODEL, "Waking Tetra", { type: "model/gltf-binary", bytes: TETRA_MODEL_BYTES }),
  ];
  if (options.kite ?? true) {
    items.push(
      mediaItem(KITE, "Finding the kite", { type: "image/webp", bytes: KITE_BYTES, weight: 1 }),
      mediaItem(KITE_BOWS, "Finding the kite", {
        type: "image/webp",
        bytes: KITE_BOWS_BYTES,
        weight: 1,
      }),
    );
  }
  return deferred ? items.map((item) => ({ ...item, deferred: true, priority })) : items;
}
