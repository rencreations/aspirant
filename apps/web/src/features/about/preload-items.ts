import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { ABOUT_PICTURES } from "./content";
import { DRONE_MODEL, DRONE_MODEL_BYTES, pickReel, REEL_POSTER } from "./media";

/** The first phase's two pictures arrive a few screens down: they are waited for, the rest follow. */
const FIRST_PICTURES = 2;

/**
 * What the About page needs before it opens. The opening is played by the drone the moment the
 * loading screen leaves, so the scene's script and the model are waited for, and the reel plays by
 * itself on the first screen, so it is waited for too, whole, in the size of the display, with its
 * still. The pictures of the first phase follow close behind the statement; the pictures of the
 * later phases are far down the page and arrive in the background.
 *
 * The scene and the film also load these files by themselves, through the same store, so a visit
 * where this list never ran (a returning tab, the browser's Back) still gets them.
 */
export function aboutItems(): PreloadItem[] {
  const reel = pickReel(typeof window === "undefined" ? 1920 : window.innerWidth);
  return [
    chunkItem("about-drone", "Waking the drone", () => import("./drone/drone-scene"), 3),
    mediaItem(DRONE_MODEL, "Waking the drone", {
      type: "model/gltf-binary",
      bytes: DRONE_MODEL_BYTES,
      weight: 1,
    }),
    imageItem(REEL_POSTER, "Loading the reel", 1),
    mediaItem(reel.src, "Loading the reel", { type: "video/mp4", bytes: reel.bytes }),
    ...ABOUT_PICTURES.map((path, i) => {
      const item = imageItem(path, "Loading the phases", 1);
      return i < FIRST_PICTURES ? item : { ...item, deferred: true, priority: 20 };
    }),
  ];
}
