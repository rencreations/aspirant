import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";
import { isCharacterSlug, type CharacterSlug } from "@/lib/slugs";

import { libraryDataItem } from "../data";
import { loadCoreFiles } from "./bundle";
import { loadBundle, ORDER, panelStill, stageStill } from "./characters";
import { startSlug } from "./start";

/** The welcome and the idle loop of a character, as one item that reports the bytes received. */
function coreItem(slug: CharacterSlug, label: string, deferred: false | number): PreloadItem {
  return {
    id: `animation:core:${slug}`,
    label,
    weight: 30,
    memo: false,
    ...(deferred === false ? {} : { deferred: true, priority: deferred, group: slug }),
    run: async (report, context) => {
      const bundle = await loadBundle(slug);
      if (bundle)
        await loadCoreFiles(bundle, { onFraction: report, background: context.background });
    },
  };
}

/**
 * What the carousel needs on first paint: its data, its code, the picture of every panel on the
 * ring, and the welcome and the idle loop of the character in front (the real bytes move the bar).
 * The characters beside it warm in the background, the next one first (the ring drifts to it). The
 * rest of the ten load when they come near the front, and their other clips only in full screen.
 */
export function items(): PreloadItem[] {
  const first = startSlug();
  const at = ORDER.indexOf(first);
  const next = ORDER[(at + 1) % ORDER.length]!;
  const before = ORDER[(at - 1 + ORDER.length) % ORDER.length]!;
  return [
    libraryDataItem("animation"),
    chunkItem("library-animation", "Opening the animation room", () => import("./page"), 2),
    // The panels, which are the thumbnails too.
    ...ORDER.map((slug) => imageItem(panelStill(slug), "Loading the panels", 1)),
    imageItem(stageStill(first), "Loading the picture", 1),
    coreItem(first, "Loading the first animation", false),
    coreItem(next, "Loading the next animation", 20),
    coreItem(before, "Loading the animation before", 30),
  ];
}

/**
 * The loading list of `/collection/animation/<character>`, the full screen view of one character:
 * the data, the code, the character's picture, its welcome and its idle loop. Its other clips are
 * what its buttons play: the visitor asks for them, so they are not waited for (each button shows
 * that it is loading until its clip is in). The panels of the ring warm last, for the way back.
 */
export function characterItems(character: string): PreloadItem[] {
  if (!isCharacterSlug(character)) return [];
  return [
    libraryDataItem("animation"),
    chunkItem(
      "library-animation-view",
      "Opening the animation",
      () => import("./character-view"),
      2,
    ),
    imageItem(panelStill(character), "Loading the picture", 1),
    imageItem(stageStill(character), "Loading the picture", 1),
    coreItem(character, "Loading the animation", false),
    ...ORDER.filter((slug) => slug !== character).map((slug): PreloadItem => ({
      ...imageItem(panelStill(slug), "Loading the panels", 1),
      deferred: true,
      priority: 80,
    })),
  ];
}
