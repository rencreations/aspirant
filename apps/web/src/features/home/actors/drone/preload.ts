import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import {
  DRONE_MODEL,
  DRONE_MODEL_BYTES,
  FACES_A,
  FACES_A_BYTES,
  FACES_B,
  FACES_B_BYTES,
  MARKS,
  MARKS_BYTES,
} from "./model";

/**
 * What the normal drone needs: its script (three's scene code, one lazy chunk), the model it
 * shares with `/about` (250 KB, the same file and the same saved copy), the two pages of extra
 * faces (35 KB together) and the icons file (25 KB, only its bang is used, for the shock mark). The
 * shock mark and the extra faces are not needed to draw the drone at rest: a page that did not
 * arrive shows the plain face and no mark, and the actor loads them itself through the same store,
 * so a visit that never ran this list still works.
 *
 * A section decides whether the first screen waits for the drone: pass `deferred: false` where it is
 * in view when the page opens (the loader, the hero), and leave the default where it comes later (it
 * then keeps downloading behind the urgent items).
 */
export function droneItems(options: { deferred?: boolean; priority?: number } = {}): PreloadItem[] {
  const deferred = options.deferred ?? true;
  const priority = options.priority ?? 10;
  const items: PreloadItem[] = [
    chunkItem("home-drone", "Waking the drone", () => import("./index"), 3),
    mediaItem(DRONE_MODEL, "Waking the drone", {
      type: "model/gltf-binary",
      bytes: DRONE_MODEL_BYTES,
    }),
    mediaItem(FACES_A, "Waking the drone", { type: "image/webp", bytes: FACES_A_BYTES, weight: 1 }),
    mediaItem(FACES_B, "Waking the drone", { type: "image/webp", bytes: FACES_B_BYTES, weight: 1 }),
    mediaItem(MARKS, "Waking the drone", { type: "image/webp", bytes: MARKS_BYTES, weight: 1 }),
  ];
  return deferred ? items.map((item) => ({ ...item, deferred: true, priority })) : items;
}
