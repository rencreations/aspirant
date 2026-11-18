import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { SB_MODEL, SB_MODEL_BYTES } from "./facts";

/**
 * What Silverbolt needs: its script (the actor, one lazy chunk) and one file, the model with its
 * maps and its five baked clips (0.3 MB). The flight, the dance, the face, the tail and the
 * reactions are code. The actor loads the same path through the same media store, so the bytes the
 * loading list fetched are the bytes it parses, and a visit that never ran this list still works.
 *
 * A section decides whether the first screen waits for the dragon: pass `deferred: false` where it
 * is in view when the page opens, and leave the default where it appears further down (it then
 * keeps downloading behind the urgent items).
 */
export function silverboltItems(
  options: { deferred?: boolean; priority?: number } = {},
): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 40;
  const items: PreloadItem[] = [
    chunkItem("home-silverbolt", "Waking Silverbolt", () => import("./index")),
    mediaItem(SB_MODEL, "Waking Silverbolt", {
      type: "model/gltf-binary",
      bytes: SB_MODEL_BYTES,
    }),
  ];
  return deferred ? items.map((item) => ({ ...item, deferred: true, priority })) : items;
}
