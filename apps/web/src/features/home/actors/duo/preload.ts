import { COMPANION_MODEL, COMPANION_MODEL_BYTES } from "@/features/about/companions/model";
import { chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

/**
 * What the duo needs: the code of the actor (three, the face shader, the performance) and the
 * model, the same file as /about's (`/models/about/companion.glb`, 241 KB, shared with that page's
 * saved copy). Deferred by default, so a section that shows them further down lets them arrive
 * behind the urgent items and the scene that needs them shows its loading state until they have.
 * A section that shows them at first paint (the opening carries the logo with them) passes
 * `deferred: false` and the loading bar waits for both.
 */
export function duoItems(options: { deferred?: boolean; priority?: number } = {}): PreloadItem[] {
  const items = [
    chunkItem("home-duo", "Preparing the two drones", () => import("./index"), 1),
    mediaItem(COMPANION_MODEL, "Loading the two drones", {
      type: "model/gltf-binary",
      bytes: COMPANION_MODEL_BYTES,
    }),
  ];
  if (options.deferred === false) return items;
  return items.map((item) => ({ ...item, deferred: true, priority: options.priority ?? 30 }));
}
