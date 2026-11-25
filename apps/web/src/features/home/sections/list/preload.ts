import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { preloadSelenaCast } from "../vp";
import { selenaItems } from "../../actors/selena/preload";
import { silverboltItems } from "../../actors/silverbolt/preload";

import { PICTURE_FRAMES, SELENA_FRAME } from "./frames";

const later = (item: PreloadItem, priority: number): PreloadItem => ({
  ...item,
  deferred: true,
  priority,
});

/**
 * The list is about twenty screens down, but Selena in 3D is its tenth frame and the strip shows her
 * (the small picture beside the frame) from the sixth on, so her files are WAITED for (the owner,
 * 24 Nov 2026: a visitor who scrolls fast must never meet a frame without her): her model with its
 * clips and cameras (about 2 MB with the sky), the dragon's model with its clips (0.3 MB) and the
 * code of this section. The rest is deferred. In the order the scroll reaches them: the code of the section, the ten 4:5 stills (the first thing a frame shows,
 * and what stays while its loop is on the way), the four loops in the frame order (Obsidia, Angela,
 * Lesley and Chang'e; the other five frames are pictures, round nine), Selena's model
 * and cameras (her frame is the last), then what only a press needs: the whole picture of a still
 * and of a loop. The loops are held whole in memory by the media store (a seamless loop is better
 * whole) and saved in the browser, so a second visit does not download them again.
 */
export function preload(): PreloadItem[] {
  const items: PreloadItem[] = [
    chunkItem("home-list", "Loading the list", () => import("./runtime"), 1),
  ];
  PICTURE_FRAMES.forEach((f, i) => {
    items.push(later(imageItem(f.poster, `Loading ${f.name}`), 34 + i * 0.01));
  });
  items.push(imageItem(SELENA_FRAME.poster, `Loading ${SELENA_FRAME.name}`));
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
  if (preloadSelenaCast()) items.push(...selenaItems({ deferred: false }));
  // The dragon stands behind her in the tenth frame (round seven).
  if (preloadSelenaCast()) items.push(...silverboltItems({ deferred: false }));
  PICTURE_FRAMES.forEach((f, i) => {
    const whole = f.kind === "video" ? f.posterFull : libUrl(f.full.lib);
    items.push(later(imageItem(whole, `Loading the whole picture of ${f.name}`), 46 + i * 0.01));
  });
  return items;
}
