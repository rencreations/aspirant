import { dataItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { SELENA_CAMERAS, SELENA_CAMERAS_R7, SELENA_MODEL, SELENA_MODEL_BYTES } from "./constants";
import { SKY_IMAGE, SKY_IMAGE_BYTES } from "./sky";

/**
 * What Selena needs: her model (1.75 MB, with the pictures, the skin weights, the four clips and
 * the face shapes) and the baked cameras (14 KB). The face, the poses, the springs and the fingers
 * are code. A section decides whether the first screen waits for her: pass `deferred: false` where
 * she is in view when the page opens, and leave the default where she appears further down (she
 * then keeps downloading behind the urgent items). The actor loads the same paths, so the bytes
 * are shared.
 */
export function selenaItems(
  options: { deferred?: boolean; priority?: number } = {},
): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const items = [
    mediaItem(SELENA_MODEL, "Loading Selena", {
      type: "model/gltf-binary",
      bytes: SELENA_MODEL_BYTES,
    }),
    dataItem(SELENA_CAMERAS, "Loading the camera"),
    dataItem(SELENA_CAMERAS_R7, "Loading the camera"),
    // The sky behind her (the owner's equirectangular picture, 266 KB).
    mediaItem(SKY_IMAGE, "Loading the sky", { type: "image/webp", bytes: SKY_IMAGE_BYTES }),
  ];
  return deferred
    ? items.map((i) => ({ ...i, deferred: true, priority: options.priority ?? 40 }))
    : items;
}
