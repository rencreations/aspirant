import { chunkItem, imageItem, type PreloadItem } from "@/lib/preload";
import { isCharacterSlug, type CharacterSlug } from "@/lib/slugs";

import { libraryDataItem } from "../data";
import { loadCoreFiles } from "./bundle";
import { loadBundle, ORDER, stageStill } from "./characters";
import { splashFor } from "./splash";
import { startSlug } from "./start";
import { THEME_TRACK, themeItem } from "./theme-music";

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
 * The songs of some characters, once each: a pair shares one song, and its item has one id, so a
 * second (deferred) copy would take the place of the first (waited) one in the loading list.
 */
function themeItems(
  entries: ReadonlyArray<readonly [CharacterSlug, false | number]>,
): PreloadItem[] {
  const seen = new Set<string>();
  const out: PreloadItem[] = [];
  for (const [slug, deferred] of entries) {
    const song = THEME_TRACK[slug];
    if (seen.has(song)) continue;
    seen.add(song);
    out.push(themeItem(slug, deferred));
  }
  return out;
}

/**
 * What the carousel needs on first paint: its data, its code, the splash art of every panel on the
 * ring (the thumbnails too), the welcome and the idle loop of the character in front (the real
 * bytes move the bar) and her song. The characters beside it warm in the background, the next one
 * first. The rest of the ten load when they come near the front, and their other clips only in
 * full screen.
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
    ...ORDER.map((slug) => imageItem(splashFor(slug).src, "Loading the panels", 1)),
    imageItem(stageStill(first), "Loading the picture", 1),
    coreItem(first, "Loading the first animation", false),
    coreItem(next, "Loading the next animation", 20),
    coreItem(before, "Loading the animation before", 30),
    ...themeItems([
      [first, false],
      [next, 25],
      [before, 35],
    ]),
  ];
}

/**
 * The loading list of `/collection/animation/<character>`, the full screen view of one character:
 * the data, the code, the character's picture, its welcome, its idle loop and its song. Its other clips are
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
    imageItem(splashFor(character).src, "Loading the picture", 1),
    imageItem(stageStill(character), "Loading the picture", 1),
    coreItem(character, "Loading the animation", false),
    themeItem(character, false),
    ...ORDER.filter((slug) => slug !== character).map((slug): PreloadItem => ({
      ...imageItem(splashFor(slug).src, "Loading the panels", 1),
      deferred: true,
      priority: 80,
    })),
  ];
}
