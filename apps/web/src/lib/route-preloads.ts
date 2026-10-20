import { isSlug } from "@/content/characters";
import { ABOUT_IMAGES, aboutImagePath } from "@/features/character/selena/about/about-images";
import {
  MENU_ICON,
  SELENA_VOICE_COUNT,
  selenaItems,
  selenaVoicePath,
  trailerItem,
} from "@/features/character/selena/media";
import { galleryItems } from "@/features/character/selena/gallery/gallery-media";
import { galleryItems as obsidiaGalleryItems } from "@/features/character/obsidia/gallery/gallery-media";
import { skillItems as obsidiaSkillItems } from "@/features/character/obsidia/skills/skills-media";
import { skillItems } from "@/features/character/selena/skills/skills-media";
import {
  ABOUT_IMAGES as OBSIDIA_ABOUT_IMAGES,
  aboutImagePath as obsidiaAboutImagePath,
} from "@/features/character/obsidia/about/about-images";
import {
  OBSIDIA_MUSIC,
  OBSIDIA_UI_IMAGES,
  OBSIDIA_VOICE_COUNT,
  formItems as obsidiaFormItems,
  obsidiaItems,
  obsidiaVoicePath,
  trailerItem as obsidiaTrailerItem,
} from "@/features/character/obsidia/media";
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
      // The stage videos come first (the list is started in order, and big downloads queue in it),
      // so the page can start while the clips, the trailer and the voice lines are still arriving.
      return [
        ...shared,
        ...selenaItems(),
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
        ...galleryItems(),
        savedItem("/audio/voice/selena/09-a.m4a", "Loading her voice lines", 1),
        savedItem("/audio/voice/selena/09-b.m4a", "Loading her voice lines", 1),
      ];
    }
    if (slug === "obsidia") {
      // Her page and its three pages share one stage, like Selena's: one list covers them all.
      // Only what the first minute needs is waited for: the welcome, the idle loop, her picture,
      // the buttons and the music, and the clips of the page the visitor landed on. The rest (the
      // other page clips, the shorts, the skill clips, the trailer, her voice lines and the
      // pictures) is deferred: it loads in the background once the page is open, and a button
      // that needs something that is still arriving shows that it is loading.
      const landed = path.split("/")[3];
      const later = (items: readonly PreloadItem[]): PreloadItem[] =>
        items.map((i) => ({ ...i, deferred: true }));
      return [
        ...shared,
        ...obsidiaItems({ page: landed }),
        imageItem("/video/obsidia/still.webp", "Loading Obsidia", 1),
        ...OBSIDIA_UI_IMAGES.map((p) => imageItem(p, "Loading the buttons", 1)),
        imageItem("/img/char/obsidia/splash-sm.webp", "Loading the album art", 1),
        mediaItem(OBSIDIA_MUSIC, "Loading the music", {
          type: "audio/mp4",
          weight: 3,
          timeoutMs: 120_000,
        }),
        ...later([
          imageItem("/video/obsidia/trailer-poster.webp", "Loading the trailer", 1),
          ...Array.from({ length: OBSIDIA_VOICE_COUNT }, (_, i) =>
            savedItem(obsidiaVoicePath(i + 1), "Loading her voice lines", 1),
          ),
          ...OBSIDIA_ABOUT_IMAGES.map((name) =>
            imageItem(obsidiaAboutImagePath(name), "Loading the About pictures", 1),
          ),
          ...obsidiaSkillItems(),
          ...obsidiaGalleryItems(),
          obsidiaTrailerItem(),
          ...obsidiaFormItems(),
        ]),
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
