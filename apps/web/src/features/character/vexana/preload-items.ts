import { autoQuality } from "@/components/video-player/player-math";
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
    timeoutMs: 180_000,
  });
}

/**
 * What Vexana's page needs before it opens: the figures of the opening, the posters of the two
 * silent videos of the first screens, the short in the signature, and her music.
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
    mediaItem(MUSIC, "Loading the music", { type: "audio/mp4", weight: 3, timeoutMs: 120_000 }),
  ];
}

/**
 * Everything else, in the order the page gets to it. Each group is deferred: the loading bar does
 * not wait for it, and it keeps downloading in the background once the page is open. The long
 * videos (her daily life, the comic films, the second film with sound) stream when they are
 * played, so only their posters are fetched.
 */
export function vexanaLater(): Array<{ priority: number; items: PreloadItem[] }> {
  const pick = autoQuality(FINAL_SOURCES, {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  });
  const small: VideoName[] = ["heart-dance", "3d-process", "interactive-drama"];
  const streamed: VideoName[] = ["final2", "comic-jp", "live-vexana"];
  return [
    { priority: 20, items: [videoItem("final", "Loading the film", pick.src)] },
    {
      priority: 22,
      items: [videoItem("skin-showcase", "Loading her registry")],
    },
    { priority: 25, items: [videoItem("final2", "Loading the film")] },
    {
      priority: 30,
      items: [
        ...SKILL_ICONS.map((n) => imageItem(skillIcon(n), "Loading the skill icons")),
        ...SKILL_CLIPS.map((n) => videoItem(n, "Loading the skill clips")),
        ...SKILL_CLIPS.map((n) => imageItem(videoPoster(n), "Loading the skill clips")),
      ],
    },
    { priority: 31, items: ART_NAMES.map((n) => imageItem(artThumb(n), "Loading the art")) },
    {
      priority: 35,
      items: [
        imageItem(CHIBI, "Loading the comic"),
        ...COMIC_PAGES.slice(0, 6).map((n) => imageItem(comicPage(n), "Loading the comic")),
        ...[...small, ...streamed, "final", "skin-showcase"].map((n) =>
          imageItem(videoPoster(n as VideoName), "Loading the posters"),
        ),
      ],
    },
    {
      priority: 36,
      items: [
        ...ART_NAMES.map((n) => imageItem(artPath(n), "Loading the art")),
        ...FANART_NUMBERS.map((n) => imageItem(fanartThumb(n), "Loading the fanart")),
      ],
    },
    { priority: 41, items: small.map((n) => videoItem(n, "Loading the videos")) },
    {
      priority: 42,
      items: COMIC_PAGES.slice(6).map((n) => imageItem(comicPage(n), "Loading the comic")),
    },
    {
      priority: 43,
      items: FANART_NUMBERS.map((n) => imageItem(fanartPath(n), "Loading the fanart")),
    },
  ];
}
