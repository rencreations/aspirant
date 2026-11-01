import { autoQuality } from "@/components/video-player/player-math";
import { nextCharacter } from "@/content/characters";
import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import {
  ART_NAMES,
  CHIBI,
  FIGURES,
  FINAL_SOURCES,
  MUSIC,
  artPath,
  FANART_COUNT,
  artThumb,
  comicPage,
  fanartPath,
  fanartThumb,
  skillIcon,
  videoFile,
  videoPoster,
  type SkillIcon,
  type VideoName,
} from "./media";
import { COMIC_PAGES, VIDEOS } from "./media.generated";
import { dramaPoster } from "./drama/drama-media";
import { roomItems } from "./room/media";

const FANART_NUMBERS = Array.from({ length: FANART_COUNT }, (_, i) => i + 1);

/** The clips of the Craft section, in the order of its keys. */
const SKILL_CLIPS: readonly VideoName[] = ["skill-passive", "skill-1", "skill-2", "skill-3"];

const SKILL_ICONS: readonly SkillIcon[] = [
  "passive",
  "skill-1",
  "skill-2",
  "skill-3",
  "skill-3-cancel",
];

/** A video held whole in memory (and saved in the browser) so its section starts at once. */
function videoItem(name: VideoName, label: string, src = videoFile(name)): PreloadItem {
  const bytes = VIDEOS[name].bytes;
  return mediaItem(src, label, {
    type: "video/mp4",
    bytes: bytes > 0 ? bytes : undefined,
  });
}

/**
 * What Vexana's page needs before it opens: the figures of the opening, the short in the
 * signature, her music, and everything that animates or shows on the sections near the top (the
 * Registry's skin video, the Craft clips and icons, every poster, the art and fan art thumbnails,
 * the first comic pages). One version only: a slow connection waits behind the loading screen for
 * all of it (owner decision, 1 Nov 2026). What stays in the background is the long films and the
 * full size pictures, which the visitor opens by pressing or scrolling a long way.
 */
export function vexanaFirstPaint(): PreloadItem[] {
  return [
    chunkItem("vexana-figure", "Loading the opening", () => import("./opening/figure-gl")),
    imageItem(FIGURES.normalFront, "Loading Vexana", 3),
    imageItem(FIGURES.enderFront, "Loading her Ender form", 3),
    imageItem(FIGURES.normalSide, "Loading her profile", 2),
    imageItem(FIGURES.enderSide, "Loading her Ender profile", 2),
    imageItem(videoPoster("splash-short"), "Loading the signature", 1),
    imageItem(videoPoster("final2"), "Loading the film", 1),
    videoItem("splash-short", "Loading the signature"),
    mediaItem(MUSIC, "Loading the music", { type: "audio/mp4", weight: 3 }),
    videoItem("skin-showcase", "Loading her registry"),
    ...SKILL_ICONS.map((n) => imageItem(skillIcon(n), "Loading the skill icons")),
    ...SKILL_CLIPS.map((n) => videoItem(n, "Loading the skill clips")),
    ...SKILL_CLIPS.map((n) => imageItem(videoPoster(n), "Loading the skill clips")),
    ...ART_NAMES.map((n) => imageItem(artThumb(n), "Loading the art")),
    imageItem(CHIBI, "Loading the comic"),
    // The title screen of the interactive drama; its episodes load when they are played.
    imageItem(dramaPoster("1"), "Loading the interactive drama"),
    ...COMIC_PAGES.slice(0, 6).map((n) => imageItem(comicPage(n), "Loading the comic")),
    ...POSTERS.map((n) => imageItem(videoPoster(n), "Loading the posters")),
    ...FANART_NUMBERS.map((n) => imageItem(fanartThumb(n), "Loading the fanart")),
  ];
}

/** The posters of the videos that are not waited for (the ones of the first screens are above). */
const POSTERS: readonly VideoName[] = [
  "heart-dance",
  "3d-process",
  "comic-jp",
  "live-vexana",
  "final",
  "skin-showcase",
  "music",
];

/**
 * Everything else, in the order the page gets to it. Each group is deferred: the loading bar does
 * not wait for it, and it keeps downloading in the background once the page is open. These are
 * the long films, the full size pictures and the room, which the visitor reaches by pressing or
 * by scrolling far down. The long videos (her daily life, the comic films, the second film with
 * sound) stream when they are played.
 */
export function vexanaLater(): Array<{ priority: number; items: PreloadItem[] }> {
  const pick = autoQuality(FINAL_SOURCES, {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  });
  const small: VideoName[] = ["heart-dance", "3d-process"];
  return [
    { priority: 20, items: [videoItem("final", "Loading the film", pick.src)] },
    { priority: 25, items: [videoItem("final2", "Loading the film")] },
    { priority: 36, items: ART_NAMES.map((n) => imageItem(artPath(n), "Loading the art")) },
    // The music video streams (57 MB, played muted by itself and with sound in the player), so only
    // its poster is fetched ahead (with the other posters, above).
    { priority: 41, items: small.map((n) => videoItem(n, "Loading the videos")) },
    {
      priority: 42,
      items: COMIC_PAGES.slice(6).map((n) => imageItem(comicPage(n), "Loading the comic")),
    },
    {
      priority: 43,
      items: FANART_NUMBERS.map((n) => imageItem(fanartPath(n), "Loading the fanart")),
    },
    // The room at the bottom: the welcome and the idle loop of the visitor's size first (the way
    // into the room waits for them, see `room/room-load.ts`), then the three shorts, then the zoom
    // pose. The size is large, so it comes last and takes at most two download slots.
    ...roomGroups(),
  ];
}

/** The room's videos in three groups, in the order the room wants them, plus the next preview. */
function roomGroups(): Array<{ priority: number; items: PreloadItem[] }> {
  const all = roomItems();
  const file = (i: PreloadItem) => i.id.split(":").at(-1) ?? "";
  const core = all.filter((i) => file(i) === "welcome.mp4" || file(i) === "idle.mp4");
  const shorts = all.filter((i) => file(i).startsWith("short-"));
  const pose = all.filter((i) => file(i).startsWith("gallery-"));
  const preview = `/img/char/${nextCharacter("vexana").slug}/splash-sm.webp`;
  return [
    { priority: 39, items: [imageItem(preview, "Loading the next character")] },
    { priority: 44, items: core },
    { priority: 45, items: shorts },
    { priority: 46, items: pose },
  ];
}
