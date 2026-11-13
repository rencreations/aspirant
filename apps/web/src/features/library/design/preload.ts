import { libUrl } from "@/lib/library";
import { imageItem, chunkItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { fetchLibraryJson, libraryDataItem, libraryDataPath } from "../data";
import { heroFilmUrl } from "./hero-media";
import { coverOf, pickSize } from "./model";
import type { DesignFile } from "./types";

/** How many posters the first screen shows: the loading bar waits for these. */
const FIRST_SCREEN = 8;

const dataFile = () => fetchLibraryJson<DesignFile>(libraryDataPath("design"));

/** The still of the film: the first frame, shown while the film loads and if it cannot play. */
function heroStillItem(): PreloadItem {
  return {
    id: "library-design-hero-still",
    label: "Loading the film",
    weight: 1,
    run: async (report, context) => {
      const file = await dataFile();
      await imageItem(libUrl(file.hero.poster), "Loading the film").run(report, context);
    },
  };
}

/**
 * The film behind the title. It plays by itself on the first screen, so it is waited for, whole
 * (about 20 MB, or 11 on a narrow display): the size that fits the display, held in memory and
 * saved in the browser, so the next visit does not download it again.
 */
function heroFilmItem(): PreloadItem {
  return {
    id: "library-design-hero-film",
    label: "Loading the film",
    weight: 14,
    memo: false,
    run: async (report, context) => {
      const file = await dataFile();
      const film = heroFilmUrl(file.hero);
      if (!film) return;
      await mediaItem(film.url, "Loading the film", {
        type: "video/mp4",
        bytes: film.bytes,
      }).run(report, context);
    },
  };
}

/**
 * The first posters of the wall (the oldest campaign, the default order). They show as soon as the
 * page is first scrolled. It reads the data file (already in the cache from the item before it) and
 * loads the pictures, so the wall opens full.
 */
function firstScreenItem(): PreloadItem {
  return {
    id: "library-design-first",
    label: "Loading the first posters",
    weight: 3,
    run: async (report, context) => {
      const file = await dataFile();
      const first = [...file.campaigns].sort((a, b) => a.from.localeCompare(b.from))[0];
      const byId = new Map(file.items.map((p) => [p.id, p]));
      const keys = (first?.posts ?? [])
        .slice(0, FIRST_SCREEN)
        .map((id) => byId.get(id))
        .filter((p) => p !== undefined)
        .map((p) => coverOf(p)[pickSize(300, 300, window.devicePixelRatio || 1)]);
      let done = 0;
      await Promise.all(
        keys.map((key) =>
          imageItem(libUrl(key), "Loading a poster")
            .run(() => undefined, context)
            .then(() => {
              done += 1;
              report(done / keys.length);
            }),
        ),
      );
    },
  };
}

/** The picture of the post that a link opens on (`/collection/design/<slug>/`). */
function postItem(slug: string): PreloadItem {
  return {
    id: `library-design-post:${slug}`,
    label: "Loading the post",
    weight: 2,
    run: async (_report, context) => {
      const file = await dataFile();
      const post = file.items.find((p) => p.slug === slug);
      const key = post?.kind === "reel" ? post.video?.poster : post?.slides?.[0]?.img.p;
      if (key) await imageItem(libUrl(key), "Loading the post").run(() => undefined, context);
    },
  };
}

/**
 * What the design room needs on first paint: its data, its code, the film (and its still) and the
 * first posters. A link to a post (`slug`) adds the picture that its window opens on.
 */
export function items(slug?: string): PreloadItem[] {
  return [
    libraryDataItem("design"),
    chunkItem("library-design", "Opening the design room", () => import("./page"), 2),
    heroStillItem(),
    heroFilmItem(),
    firstScreenItem(),
    ...(slug ? [postItem(slug)] : []),
  ];
}
