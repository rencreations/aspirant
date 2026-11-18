import { mediaItem, type PreloadItem } from "@/lib/preload";

/** The doll's model, as the media store knows it. The actor loads the same path, so the bytes are shared. */
export const DOLL_MODEL_PATH = "/models/home/doll.glb";
export const DOLL_MODEL_BYTES = 1_132_208;

/**
 * What the doll needs: her model (1.1 MB, with the maps, the skin weights and the baked walk).
 * The face, the poses and the walk are code. A section decides whether the first screen waits for
 * her: pass `deferred: false` where she is in view when the page opens, and leave the default
 * where she appears further down (she then keeps downloading behind the urgent items).
 */
export function dollItems(options: { deferred?: boolean; priority?: number } = {}): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const item = mediaItem(DOLL_MODEL_PATH, "Loading the doll", {
    type: "model/gltf-binary",
    bytes: DOLL_MODEL_BYTES,
  });
  return [deferred ? { ...item, deferred: true, priority: options.priority ?? 40 } : item];
}
