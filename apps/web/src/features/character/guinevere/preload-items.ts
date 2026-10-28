import { autoQuality } from "@/components/video-player/player-math";
import { nextCharacter } from "@/content/characters";
import { imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { dramaPoster } from "../vexana/drama/drama-media";
import { CHIBI, comicPage, videoFile as vexanaVideoFile } from "../vexana/media";
import { COMIC_PAGES, VIDEOS as VEXANA_VIDEOS } from "../vexana/media.generated";
import {
  ART_NAMES,
  FANART_COUNT,
  FINAL_SOURCES,
  HERO_LOOP,
  heroLoopFile,
  MUSIC,
  WEB,
  artPath,
  artThumb,
  fanartPath,
  fanartThumb,
  skillIcon,
  videoFile,
  videoPoster,
  type SkillIcon,
  type VideoName,
} from "./media";
import { roomItems } from "./room/media";
import { VIDEOS } from "./videos";

const FANART_NUMBERS = Array.from({ length: FANART_COUNT }, (_, i) => i + 1);

/** The clips of the Craft section, in the order of its keys. */
const SKILL_CLIPS: readonly VideoName[] = ["skill-passive", "skill-1", "skill-2", "skill-3"];

const SKILL_ICONS: readonly SkillIcon[] = [
  "passive",
  "skill-1",
  "skill-2",
  "skill-2-blink",
  "skill-3",
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
 * What Guinevere's page needs before it opens: the hero loop (a silent recording, 1 to 2 MB) and its
 * first frame, the posters of the two silent videos of the first screens, and the signature short's
 * poster.
 */
export function guinevereFirstPaint(): PreloadItem[] {
  const hero = heroLoopFile();
  return [
    imageItem(HERO_LOOP.poster, "Loading Guinevere", 3),
    mediaItem(hero.src, "Loading Guinevere", {
      type: "video/mp4",
      bytes: hero.bytes,
      timeoutMs: 60_000,
    }),
    imageItem(videoPoster("splash-short"), "Loading the signature", 1),
    imageItem(videoPoster("final2"), "Loading the film", 1),
  ];
}

/**
 * Everything else, in the order the page gets to it. Each group is deferred: the loading bar does
 * not wait for it, and it keeps downloading in the background once the page is open. The long
 * videos (her livestream, the second film with sound, the music video) stream when they are
 * played, so only their posters are fetched. The comic, the interactive drama and the 3D process
 * are Vexana's own sections, so their files are the ones her page loads.
 */
export function guinevereLater(): Array<{ priority: number; items: PreloadItem[] }> {
  const pick = autoQuality(FINAL_SOURCES, {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  });
  const small: VideoName[] = ["heart-dance"];
  const streamed: VideoName[] = ["final2", "live-guin"];
  return [
    // The music and the signature short are first in line, right after the page opens, but they are
    // not waited for: they are 7.7 MB of the 8.5 MB the first screen used to wait for, and a slow
    // line should open the hero from its two small pictures (the page streams both from the file
    // until they have arrived).
    {
      priority: 2,
      items: [mediaItem(MUSIC, "Loading the music", { type: "audio/mp4", timeoutMs: 120_000 })],
    },
    { priority: 3, items: [videoItem("splash-short", "Loading the signature")] },
    { priority: 20, items: [videoItem("final", "Loading the film", pick.src)] },
    { priority: 22, items: [videoItem("skin-showcase", "Loading her registry")] },
    { priority: 25, items: [videoItem("final2", "Loading the film")] },
    {
      priority: 28,
      items: [
        // The story pair: both halves and the two drones.
        ...Object.values(WEB).map((p) => imageItem(p, "Loading the story")),
      ],
    },
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
        // The title screen of the interactive drama; its episodes load when they are played.
        imageItem(dramaPoster("1"), "Loading the interactive drama"),
        ...COMIC_PAGES.slice(0, 6).map((n) => imageItem(comicPage(n), "Loading the comic")),
        ...[...small, ...streamed, "final", "skin-showcase"].map((n) =>
          imageItem(videoPoster(n as VideoName), "Loading the posters"),
        ),
        imageItem("/video/vexana/comic-jp-poster.webp", "Loading the posters"),
        imageItem("/video/vexana/3d-process-poster.webp", "Loading the posters"),
      ],
    },
    {
      priority: 36,
      items: [
        ...ART_NAMES.map((n) => imageItem(artPath(n), "Loading the art")),
        ...FANART_NUMBERS.map((n) => imageItem(fanartThumb(n), "Loading the fanart")),
      ],
    },
    // The music video streams (about 78 MB, played muted by itself and with sound in the player), so
    // only its poster is fetched ahead.
    { priority: 40, items: [imageItem(videoPoster("music"), "Loading the music video")] },
    {
      priority: 41,
      items: [
        ...small.map((n) => videoItem(n, "Loading the videos")),
        // The 3D process is Vexana's own section: her file.
        mediaItem(vexanaVideoFile("3d-process"), "Loading the videos", {
          type: "video/mp4",
          bytes: VEXANA_VIDEOS["3d-process"].bytes || undefined,
          timeoutMs: 180_000,
        }),
      ],
    },
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
  const preview = `/img/char/${nextCharacter("guinevere").slug}/splash-sm.webp`;
  const buttons = ["btn-action-1", "btn-action-2", "btn-action-3", "btn-pose", "btn-back"].map(
    (n) => imageItem(`/img/guinevere/room/${n}.webp`, "Loading her room"),
  );
  return [
    { priority: 39, items: [imageItem(preview, "Loading the next character"), ...buttons] },
    { priority: 44, items: core },
    { priority: 45, items: shorts },
    { priority: 46, items: pose },
  ];
}
