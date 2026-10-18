import { isSlug } from "@/content/characters";
import { chunkItem, dataItem, fontsItem, imageItem, type PreloadItem } from "@/lib/preload";

/**
 * What each route needs on first paint. The boot screen runs the list for the page the visitor
 * landed on; a page transition runs the list for the page it is going to. Add every new asset
 * or lazy chunk that a page needs at first paint here so it shows up in the loading bar.
 */
export function routeItems(pathname: string): PreloadItem[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  const shared = [fontsItem()];

  if (path === "/") {
    return [
      ...shared,
      chunkItem(
        "home-scene",
        "Loading the portal engine",
        () => import("@/features/home/hero/PortalScene"),
        4,
      ),
      imageItem("/img/portal/vexana/base.webp", "Loading the hero art", 2),
      imageItem("/img/portal/vexana/depth.webp", "Loading depth maps", 1),
      imageItem("/img/portal/vexana/alt.webp", "Loading the hero art", 2),
      imageItem("/img/portal/vexana/depth-alt.webp", "Loading depth maps", 1),
      imageItem("/img/char/vexana/splash-sm.webp", "Loading backdrops", 1),
      imageItem("/img/char/vexana/extra-1.webp", "Loading backdrops", 1),
    ];
  }

  if (path === "/experience") {
    return [
      ...shared,
      chunkItem(
        "scenes",
        "Loading the scenes",
        () => import("@/features/experience/scenes/ScenesLayer"),
        4,
      ),
      dataItem("/data/story/index.json", "Opening the story index", 1),
      dataItem("/data/story/part-01.json", "Opening Part One", 2),
    ];
  }

  if (path === "/collection") {
    return [
      ...shared,
      dataItem("/data/manifest.json", "Reading the archive index", 2),
      dataItem("/data/comics.json", "Reading the comic index", 1),
      dataItem("/data/fanart.json", "Reading the fan art credits", 1),
    ];
  }

  if (path.startsWith("/character/")) {
    const slug = path.slice("/character/".length).split("/")[0] ?? "";
    if (isSlug(slug)) {
      return [
        ...shared,
        imageItem(`/img/char/${slug}/splash.webp`, "Loading the splash art", 3),
        imageItem(`/img/char/${slug}/cutout.webp`, "Loading the cutout", 2),
        dataItem(`/audio/voice/${slug}/index.json`, "Reading the voice index", 1),
      ];
    }
  }

  return shared;
}
