import { isSlug } from "@/content/characters";
import { ABOUT_IMAGES, aboutImagePath } from "@/features/character/selena/about/about-images";
import {
  MENU_ICON,
  SELENA_VOICE_COUNT,
  selenaItems,
  selenaVoicePath,
  trailerItem,
} from "@/features/character/selena/media";
import { skillItems } from "@/features/character/selena/skills/skills-media";
import {
  chunkItem,
  dataItem,
  fontsItem,
  imageItem,
  mediaItem,
  savedItem,
  type PreloadItem,
} from "@/lib/preload";

/** Characters that have a cut-out in `public/img/char/<slug>/` (the others have splash art only). */
const HAS_CUTOUT: ReadonlySet<string> = new Set([
  "fanny",
  "layla",
  "guinevere",
  "vexana",
  "obsidia",
  "selena",
]);

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
    if (slug === "selena") {
      // Her page and its three pages (About, Skills, Gallery) are one stage, so one list covers
      // them all: the videos in the size that suits the display, the skill clips, the trailer, the
      // music, her voice lines and every picture. All of it is loaded into memory and saved in the
      // browser, so nothing waits on the network once the page is open, and the next visit starts
      // from the saved copy. A visitor on the first visit waits for it here.
      return [
        ...shared,
        imageItem("/video/selena/still.webp", "Loading Selena", 1),
        imageItem("/video/selena/trailer-poster.webp", "Loading the trailer", 1),
        imageItem("/img/char/selena/splash-sm.webp", "Loading the album art", 1),
        ...Object.values(MENU_ICON).map((path) => imageItem(path, "Loading the buttons", 1)),
        mediaItem("/audio/music/silverbolt-raiko.m4a", "Loading the music", {
          type: "audio/mp4",
          weight: 3,
          timeoutMs: 120_000,
        }),
        ...Array.from({ length: SELENA_VOICE_COUNT }, (_, i) =>
          savedItem(selenaVoicePath(i + 1), "Loading her voice lines", 1),
        ),
        ...ABOUT_IMAGES.map((name) =>
          imageItem(aboutImagePath(name), "Loading the About pictures", 1),
        ),
        ...skillItems(),
        trailerItem(),
        ...selenaItems(),
      ];
    }
    if (isSlug(slug)) {
      return [
        ...shared,
        imageItem(`/img/char/${slug}/splash.webp`, "Loading the splash art", 3),
        ...(HAS_CUTOUT.has(slug)
          ? [imageItem(`/img/char/${slug}/cutout.webp`, "Loading the cutout", 2)]
          : []),
        dataItem(`/audio/voice/${slug}/index.json`, "Reading the voice index", 1),
      ];
    }
  }

  return shared;
}
