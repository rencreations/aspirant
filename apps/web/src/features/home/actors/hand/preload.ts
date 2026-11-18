import { mediaItem, type PreloadItem } from "@/lib/preload";

import { HAND_MODEL, HAND_MODEL_BYTES } from "./constants";

/**
 * What the hand needs: its model (273 KB, with the glove's picture, the skin weights and the two
 * clips). The finger maths, the look and the poses are code. A section decides whether the first
 * screen waits for it: pass `deferred: false` where the hand is in view when the page opens, and
 * leave the default where it appears further down (it then keeps downloading behind the urgent
 * items). The actor loads the same path, so the bytes are shared.
 */
export function handItems(options: { deferred?: boolean; priority?: number } = {}): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const item = mediaItem(HAND_MODEL, "Loading Selena's hand", {
    type: "model/gltf-binary",
    bytes: HAND_MODEL_BYTES,
  });
  return [deferred ? { ...item, deferred: true, priority: options.priority ?? 40 } : item];
}
