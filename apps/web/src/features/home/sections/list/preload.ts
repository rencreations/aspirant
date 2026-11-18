import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { selenaItems } from "../../actors/selena/preload";

import { PICTURE_FRAMES, SELENA_FRAME } from "./frames";

const later = (item: PreloadItem, priority: number): PreloadItem => ({
  ...item,
  deferred: true,
  priority,
});

/**
 * The list is about twenty screens down, so nothing here holds the first screen. In the order the
 * scroll reaches them: the code of the section, the ten 4:5 stills (the first thing a frame shows,
 * and what stays while its loop is on the way), the seven loops in the frame order, Selena's model
 * and cameras (her frame is the last), then what only a press needs: the whole picture of a still
 * and of a loop. The loops are held whole in memory by the media store (a seamless loop is better
 * whole) and saved in the browser, so a second visit does not download them again.
 */
export function preload(): PreloadItem[] {
  const items: PreloadItem[] = [
    later(
      chunkItem("home-list", "Loading the list", () => import("./runtime"), 1),
      33,
    ),
  ];
  PICTURE_FRAMES.forEach((f, i) => {
    items.push(later(imageItem(f.poster, `Loading ${f.name}`), 34 + i * 0.01));
  });
  items.push(later(imageItem(SELENA_FRAME.poster, `Loading ${SELENA_FRAME.name}`), 34.5));
  PICTURE_FRAMES.forEach((f, i) => {
    if (f.kind !== "video") return;
    items.push(
      later(
        mediaItem(f.video.path, `Loading ${f.name}'s loop`, {
          type: "video/mp4",
          bytes: f.video.bytes,
        }),
        36 + i * 0.1,
      ),
    );
  });
  items.push(...selenaItems({ priority: 40 }));
  PICTURE_FRAMES.forEach((f, i) => {
    const whole = f.kind === "video" ? f.posterFull : libUrl(f.full.lib);
    items.push(later(imageItem(whole, `Loading the whole picture of ${f.name}`), 46 + i * 0.01));
  });
  return items;
}
