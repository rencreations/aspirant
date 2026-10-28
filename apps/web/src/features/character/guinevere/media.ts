/**
 * Where Guinevere's page keeps its files. `scripts/guinevere/build.py` makes every file named here
 * and writes `media.generated.ts` (sizes, lengths). Section code reads only this file and the
 * generated one, never a literal path.
 *
 * Some files are the same on both pages and are not made twice: the film, the second film, the comic
 * film, the 3D process and the heart dance live under `/video/vexana/` (`scripts/vexana/build.py`),
 * and the five official illustrations under `/img/vexana/art/`.
 */
import type { PlayerVideo } from "@/components/video-player/player-overlay";

const IMG = "/img/guinevere";
const VID = "/video/guinevere";
const SHARED_VID = "/video/vexana";
const SHARED_IMG = "/img/vexana";

/** Her photo (one picture, a transparent cut-out): the hero of her story page. */
export const HERO = { front: `${IMG}/hero/front.webp` } as const;

/**
 * Her hero: a silent recording of her animation that closes on itself with no jump
 * (`scripts/guinevere/hero-loop.py`), in two sizes, and its first frame.
 */
export const HERO_LOOP = {
  poster: `${VID}/hero-loop-poster.webp`,
  hd: { src: `${VID}/hero-loop-1080.mp4`, bytes: 2290957 },
  lite: { src: `${VID}/hero-loop-720.mp4`, bytes: 1069597 },
} as const;

/** The size of the hero loop for this screen: the small one for a small screen or a saving line. */
export function heroLoopFile(): { src: string; bytes: number } {
  if (typeof window === "undefined") return HERO_LOOP.hd;
  const link = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const pixels = window.innerWidth * (window.devicePixelRatio || 1);
  return pixels <= 1500 || link?.saveData ? HERO_LOOP.lite : HERO_LOOP.hd;
}

export const WEB = {
  left: `${IMG}/web/left.webp`,
  right: `${IMG}/web/right.webp`,
  drone1: `${IMG}/web/drone-1.webp`,
  drone2: `${IMG}/web/drone-2.webp`,
} as const;

export const MUSIC = "/audio/music/guinevere-theme.m4a";

export type ArtName =
  | "both-splash-art"
  | "fighting-moment"
  | "fighting-stance"
  | "guinevere-splash-art"
  | "vexana-splash-art";

/** Guinevere's illustration first, Vexana's last (the order of the art section). */
export const ART_NAMES: readonly ArtName[] = [
  "guinevere-splash-art",
  "both-splash-art",
  "fighting-stance",
  "fighting-moment",
  "vexana-splash-art",
];
export const artPath = (n: ArtName) => `${SHARED_IMG}/art/${n}.webp`;
export const artThumb = (n: ArtName) => `${SHARED_IMG}/art/${n}-sm.webp`;

/** The fanart prints (portrait, 4:5): `fanart-1` to `fanart-6`, full size and a small one. */
export const FANART_COUNT = 6;
export const fanartPath = (n: number) => `${IMG}/fanart/fanart-${n}.webp`;
export const fanartThumb = (n: number) => `${IMG}/fanart/fanart-${n}-sm.webp`;

export type SkillIcon = "passive" | "skill-1" | "skill-2" | "skill-2-blink" | "skill-3";
export const skillIcon = (n: SkillIcon) => `${IMG}/skill/${n}.webp`;

/** The videos only her page has. */
export type OwnVideoName =
  | "splash-short"
  | "skin-showcase"
  | "skill-passive"
  | "skill-1"
  | "skill-2"
  | "skill-3"
  | "live-guin"
  | "music";

/** The videos that are the same on Vexana's page (her files are read). */
type SharedVideoName = "final" | "final-1080" | "final2" | "heart-dance";

export type VideoName = OwnVideoName | SharedVideoName;

const SHARED: ReadonlySet<string> = new Set<SharedVideoName>([
  "final",
  "final-1080",
  "final2",
  "heart-dance",
]);

/** What `media.generated.ts` knows about a video: its file, its poster, its size and its length. */
export interface VideoInfo {
  file: string;
  poster: string;
  bytes: number;
  /** Seconds. */
  duration: number;
  width: number;
  height: number;
}

/** What `media.generated.ts` knows about a picture. */
export interface ImageInfo {
  width: number;
  height: number;
  bytes: number;
}

const dirOf = (n: VideoName) => (SHARED.has(n) ? SHARED_VID : VID);
export const videoFile = (n: VideoName, ext = "mp4") => `${dirOf(n)}/${n}.${ext}`;
export const videoPoster = (n: VideoName) => `${dirOf(n)}/${n}-poster.webp`;

/** The shape the site's player wants, for a video of this page (one source, or a list for sizes). */
export function playerVideo(
  n: VideoName,
  title: string,
  sources: PlayerVideo["sources"],
): PlayerVideo {
  return { sources, poster: videoPoster(n), title };
}

/** The film in two sizes for the site's player (the same two files as Vexana's page). */
export const FINAL_SOURCES = [
  { label: "1080p", height: 1080, src: videoFile("final") },
  { label: "810p", height: 810, src: videoFile("final-1080") },
] as const;
