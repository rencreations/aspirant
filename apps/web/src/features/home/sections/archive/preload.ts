import { COLLECTIONS } from "@/features/library/registry";
import { libUrl } from "@/lib/library";
import { fetchWhole } from "@/lib/media-store";
import { chunkItem, type PreloadItem } from "@/lib/preload";
import { PermanentFailure, untilItArrives } from "@/lib/retry";

import { droneItems } from "../../actors/drone/preload";
import { tetraItems } from "../../actors/tetra/preload";

/** The archive is the fifteenth screen of the story: everything it needs comes after the bend section's files. */
export const PRIORITY = 70;

/** A picture that arrives whole and still cannot be decoded this many times is skipped. */
const DECODE_TRIES = 5;

/** Decode a cover the way the page's own `img` asks for it (a CORS request), so the cached copy is reused. */
function decode(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      resolve();
    };
    img.onerror = () => {
      reject(new Error(`Cannot decode ${url}`));
    };
    img.src = url;
  });
}

/**
 * One cover of the collection (1024 square, 35 to 147 KB, in the R2 bucket): fetched whole with the
 * bar counting its bytes, then decoded, so the card shows it the moment it rises. The page's `img`
 * asks for the same address with `crossOrigin="anonymous"`, the way the shelf does.
 */
export function coverItem(key: string, label: string, priority: number): PreloadItem {
  const url = libUrl(key);
  return {
    id: `archive-cover:${key}`,
    label,
    weight: 1,
    deferred: true,
    priority,
    run: (report) =>
      untilItArrives(async (n) => {
        await fetchWhole(url, {
          onBytes: (received, total) => {
            report(Math.min(0.95, received / total), { received, total });
          },
        });
        try {
          await decode(url);
        } catch (error) {
          if (n + 1 >= DECODE_TRIES) throw new PermanentFailure(String(error));
          throw error;
        }
      }),
  };
}

/**
 * What the archive needs, all deferred (nothing of it shows before the fifteenth screen): its own
 * code, the drone and Tetra (the bend section lists them too; an item two lists share is kept once),
 * and the ten covers of the shelf, about 0.8 MB. A cover that is reached first shows its colour until
 * its picture has arrived.
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-archive", "Lighting the archive", () => import("./runtime"), 2),
      deferred: true,
      priority: PRIORITY,
    },
    ...droneItems({ priority: 10 }),
    ...tetraItems({ priority: 60 }),
    ...COLLECTIONS.map((room) =>
      coverItem(room.cover, `Loading the ${room.name} cover`, PRIORITY + 1),
    ),
  ];
}
