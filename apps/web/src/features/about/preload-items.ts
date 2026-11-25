import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { BUNNY_MODEL, BUNNY_MODEL_BYTES } from "./bunny/model";
import { COMPANION_MODEL, COMPANION_MODEL_BYTES } from "./companions/model";
import { ABOUT_PICTURES } from "./content";
import {
  DOLL_MODEL,
  DOLL_MODEL_BYTES,
  DRONE_MODEL,
  DRONE_MODEL_BYTES,
  pickStart,
  START_POSTER,
} from "./media";
import { mlabelItems } from "./mlabel/footage";

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
 *
 * The drone's friends are far down the page and never on the first screen: their models come in
 * the background, in the order the page meets them (Mr. Bunny in the third phase, Guinevere's two
 * drones in the fourth, the Obsidia doll in the fifth). The scene asks for each again when the page nears it, and a friend
 * whose model has not arrived is simply not there yet: it comes in from the edge of the screen
 * when it has.
 */
export function aboutItems(): PreloadItem[] {
  const reel = pickStart(typeof window === "undefined" ? 1920 : window.innerWidth);
  return [
    chunkItem("about-drone", "Waking the drone", () => import("./drone/drone-scene"), 3),
    mediaItem(DRONE_MODEL, "Waking the drone", {
      type: "model/gltf-binary",
      bytes: DRONE_MODEL_BYTES,
      weight: 1,
    }),
    imageItem(START_POSTER, "Loading the film", 1),
    mediaItem(reel.src, "Loading the film", { type: "video/mp4", bytes: reel.bytes }),
    ...ABOUT_PICTURES.map((path, i) => {
      const item = imageItem(path, "Loading the phases", 1);
      return i < FIRST_PICTURES ? item : { ...item, deferred: true, priority: 20 };
    }),
    {
      ...mediaItem(BUNNY_MODEL, "Waking the drone's friends", {
        type: "model/gltf-binary",
        bytes: BUNNY_MODEL_BYTES,
      }),
      deferred: true,
      priority: 22,
    },
    {
      ...mediaItem(COMPANION_MODEL, "Waking the drone's friends", {
        type: "model/gltf-binary",
        bytes: COMPANION_MODEL_BYTES,
      }),
      deferred: true,
      priority: 24,
    },
    {
      ...mediaItem(DOLL_MODEL, "Waking the drone's friends", {
        type: "model/gltf-binary",
        bytes: DOLL_MODEL_BYTES,
      }),
      deferred: true,
      priority: 26,
    },
    // The footage of TheMLabel's close, at the very end of the page: in the background.
    ...mlabelItems(),
  ];
}
