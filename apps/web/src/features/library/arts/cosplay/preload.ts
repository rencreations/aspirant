import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";
import { isCharacterSlug, type CharacterSlug } from "@/lib/slugs";

import { splashFor } from "../../animation/splash";
import { libraryDataItem } from "../../data";
import { fetchArtsData } from "../core/data";
import { metricsFor, pickSize, planWall, tileRatio } from "../core/flow/math";
import { wallWidth } from "../core/flow/viewport";
import {
  ROSTER_ORDER,
  THUMBS,
  photosOf,
  thumbsOf,
  type CosplayHead,
  type CosplayItem,
} from "./model";

/**
 * What the first screen of the Cosplay rooms needs. `character` is the slug on a character's page.
 *
 * The roster waits for the data, its code, the ten splash pictures (the files of the Animation
 * room, so most are in the cache already) and the thumbnails its tiles show. A character's page
 * waits for the data, its code, her splash art and her photos at the size the rows ask for (a
 * page holds a few of them), and the preview of the photo the address opens (`?i=`). Nothing here
 * is a timer: each item reports the bytes that arrive.
 */
export function items(character?: string): PreloadItem[] {
  const list: PreloadItem[] = [libraryDataItem("arts-cosplay")];
  if (!character) {
    list.push(
      chunkItem("library-arts-cosplay", "Opening the room", () => import("./page"), 2),
      ...ROSTER_ORDER.map((slug) => imageItem(splashFor(slug).src, "Loading the Aspirants", 1)),
      rosterThumbs(),
    );
    return list;
  }
  list.push(
    chunkItem("library-arts-cosplay-character", "Opening the room", () => import("./character"), 2),
  );
  if (isCharacterSlug(character)) {
    list.push(imageItem(splashFor(character).src, "Loading her art", 2), photosOfPage(character));
  }
  return list;
}

/** Fetch every key as an image, reporting how many are in. */
async function loadAll(
  keys: readonly string[],
  label: string,
  report: (fraction: number) => void,
  context: { background: boolean },
): Promise<void> {
  let done = 0;
  await Promise.all(
    keys.map(async (key) => {
      await imageItem(libUrl(key), label).run(() => undefined, context);
      done += 1;
      report(done / Math.max(1, keys.length));
    }),
  );
}

/** The thumbnails the roster's tiles show: the first few photos of each Aspirant who has some. */
function rosterThumbs(): PreloadItem {
  return {
    id: "library-arts-cosplay-thumbs",
    label: "Loading the photos",
    weight: 2,
    run: async (report, context) => {
      const file = await fetchArtsData<CosplayItem, CosplayHead>("cosplay");
      const keys = new Set<string>();
      for (const slug of ROSTER_ORDER) {
        for (const photo of thumbsOf(photosOf(file.items, slug), THUMBS).shown) {
          keys.add(photo.img.t);
        }
      }
      await loadAll([...keys], "Loading the photos", report, context);
    },
  };
}

/**
 * One Aspirant's photos, each at the size its tile asks for (the wall's own maths, `pickSize`), and
 * the preview of the photo that `?i=` names.
 */
function photosOfPage(slug: CharacterSlug): PreloadItem {
  return {
    id: `library-arts-cosplay-photos-${slug}`,
    label: "Loading the photos",
    weight: 3,
    run: async (report, context) => {
      const file = await fetchArtsData<CosplayItem, CosplayHead>("cosplay");
      const m = metricsFor(wallWidth());
      const keys = new Set<string>();
      const photos = photosOf(file.items, slug);
      const ratios = photos.map((photo) => tileRatio(photo.img.w, photo.img.h));
      for (const block of planWall(ratios, null, m)) {
        for (const row of block.rows) {
          for (let k = 0; k < row.count; k++) {
            const photo = photos[row.start + k];
            if (!photo) continue;
            keys.add(photo.img[pickSize(row.widths[k] ?? 0, row.height, window.devicePixelRatio)]);
          }
        }
      }
      const wanted = new URLSearchParams(window.location.search).get("i");
      const linked = wanted ? file.items.find((item) => item.id === wanted) : undefined;
      if (linked) keys.add(linked.img.p);
      await loadAll([...keys], "Loading the photos", report, context);
    },
  };
}
