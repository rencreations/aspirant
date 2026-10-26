import { characters, isSlug } from "@/content/characters";
import { splashPath } from "@/features/character/roster/splash";
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
import { duoFirstPaint, duoLater } from "@/features/character/duo/duo-media";
import { guinevereFirstPaint, guinevereLater } from "@/features/character/guinevere/preload-items";
import { lfFirstPaint, lfLater } from "@/features/character/layla-fanny/preload-items";
import { vexanaFirstPaint, vexanaLater } from "@/features/character/vexana/preload-items";
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

  if (path === "/character") {
    // The wall of the ten: their splash art, the only pictures on it.
    return [
      ...shared,
      ...characters.map((c) => imageItem(splashPath(c.slug), `Loading ${c.name}`, 3)),
    ];
  }

  if (path.startsWith("/character/")) {
    const slug = path.slice("/character/".length).split("/")[0] ?? "";
    // Her page and its three pages (About, Skills, Gallery) are one stage, so one list covers them
    // all. Only what the first minute needs is waited for: the welcome and the idle loop in the size
    // that suits the display, her picture, the buttons and the music, and what belongs to the page
    // the visitor landed on. Everything else (the other pages' clips, the shorts, the skill clips,
    // the trailer, the voice lines and the pictures) is deferred: it keeps downloading in the
    // background once the page is open, nearest need first (see `PreloadItem.priority`), so it is
    // there before the visitor asks for it, and what is loaded is saved in the browser for the next
    // visit. A button whose clip is still arriving shows that it is loading.
    const landed = path.split("/")[3] ?? "";
    /** A group that belongs to one page: not deferred on that page, deferred on the others. */
    const later = (page: string | null, priority: number, items: readonly PreloadItem[]) =>
      items.map((i) => ({
        ...i,
        deferred: page === null || page !== landed,
        priority,
        group: slug,
      }));
    if (slug === "selena") {
      return [
        ...shared,
        ...selenaItems({ page: landed }),
        imageItem("/video/selena/still.webp", "Loading Selena", 1),
        imageItem("/video/selena/trailer-poster.webp", "Loading the trailer", 1),
        imageItem("/img/char/selena/splash-sm.webp", "Loading the album art", 1),
        ...Object.values(MENU_ICON).map((path) => imageItem(path, "Loading the buttons", 1)),
        mediaItem("/audio/music/silverbolt-raiko.m4a", "Loading the music", {
          type: "audio/mp4",
          weight: 3,
          timeoutMs: 120_000,
        }),
        ...later("about", 20, [
          ...Array.from({ length: SELENA_VOICE_COUNT }, (_, i) =>
            savedItem(selenaVoicePath(i + 1), "Loading her voice lines", 1),
          ),
          savedItem("/audio/voice/selena/09-a.m4a", "Loading her voice lines", 1),
          savedItem("/audio/voice/selena/09-b.m4a", "Loading her voice lines", 1),
          ...ABOUT_IMAGES.map((name) =>
            imageItem(aboutImagePath(name), "Loading the About pictures", 1),
          ),
        ]),
        ...later("skills", 30, skillItems()),
        ...later("gallery", 31, galleryItems()),
        ...later(null, 40, [trailerItem()]),
      ];
    }
    if (slug === "obsidia") {
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
        ...later("about", 20, [
          imageItem("/video/obsidia/trailer-poster.webp", "Loading the trailer", 1),
          ...Array.from({ length: OBSIDIA_VOICE_COUNT }, (_, i) =>
            savedItem(obsidiaVoicePath(i + 1), "Loading her voice lines", 1),
          ),
          ...OBSIDIA_ABOUT_IMAGES.map((name) =>
            imageItem(obsidiaAboutImagePath(name), "Loading the About pictures", 1),
          ),
          ...obsidiaFormItems(),
        ]),
        ...later("skills", 30, obsidiaSkillItems()),
        ...later("gallery", 31, obsidiaGalleryItems()),
        ...later(null, 40, [obsidiaTrailerItem()]),
      ];
    }
    if (slug === "vexana") {
      // One long page and two story pages: the same first paint, everything else in the
      // background (see `features/character/vexana/preload-items.ts`).
      return [
        ...shared,
        ...vexanaFirstPaint(),
        ...vexanaLater().flatMap((g) => later(null, g.priority, g.items)),
      ];
    }
    if (slug === "guinevere") {
      // One long page and two story pages: the same first paint, everything else in the
      // background (see `features/character/guinevere/preload-items.ts`).
      return [
        ...shared,
        ...guinevereFirstPaint(),
        ...guinevereLater().flatMap((g) => later(null, g.priority, g.items)),
      ];
    }
    if (slug === "layla" || slug === "fanny") {
      // Her page of the pair: the first screen is waited for, the voice lines, the films' posters
      // and the art arrive in the background (see `features/character/layla-fanny/preload-items.ts`).
      return [
        ...shared,
        ...lfFirstPaint(slug),
        ...lfLater(slug).flatMap((g) => later(null, g.priority, g.items)),
      ];
    }
    if (slug === "ruby" || slug === "angela") {
      // The pair's two pages: the splash art and the second picture of the hero first, then the
      // strip of the film, the posters and the voice lines in the background (see `features/character/duo/duo-media.ts`).
      return [
        ...shared,
        ...duoFirstPaint(slug),
        ...duoLater(slug).flatMap((g) => later(null, g.priority, g.items)),
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
