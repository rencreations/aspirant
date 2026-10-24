/**
 * Where Vexana's page keeps its files. `scripts/vexana/build.py` makes every file named here and
 * writes `media.generated.ts` (sizes, lengths, comic page list). Section code reads only this file
 * and the generated one, never a literal path.
 */
import type { PlayerVideo } from "@/components/video-player/player-overlay";

const IMG = "/img/vexana";
const VID = "/video/vexana";

/** The cut-outs of the hero and of the two faces (transparent webp). */
export const FIGURES = {
  normalFront: `${IMG}/hero/normal-front.webp`,
  enderFront: `${IMG}/hero/ender-front.webp`,
  normalSide: `${IMG}/hero/normal-side.webp`,
  enderSide: `${IMG}/hero/ender-side.webp`,
} as const;

export const MUSIC = "/audio/music/vexana-theme.m4a";

export type ArtName =
  | "both-splash-art"
  | "fighting-moment"
  | "fighting-stance"
  | "guinevere-splash-art"
  | "vexana-splash-art";

export const ART_NAMES: readonly ArtName[] = [
  "vexana-splash-art",
  "both-splash-art",
  "guinevere-splash-art",
  "fighting-stance",
  "fighting-moment",
];
export const artPath = (n: ArtName) => `${IMG}/art/${n}.webp`;
export const artThumb = (n: ArtName) => `${IMG}/art/${n}-sm.webp`;

/** The fanart prints (portrait, 4:5): `fanart-1` to `fanart-7`, full size and a small one. */
export const FANART_COUNT = 7;
export const fanartPath = (n: number) => `${IMG}/fanart/fanart-${n}.webp`;
export const fanartThumb = (n: number) => `${IMG}/fanart/fanart-${n}-sm.webp`;

export type SkillIcon = "passive" | "skill-1" | "skill-2" | "skill-3" | "skill-3-cancel";
export const skillIcon = (n: SkillIcon) => `${IMG}/skill/${n}.webp`;

/** A comic page by its original number (3, 23 and 40 were never supplied). */
export const comicPage = (n: number) => `${IMG}/comic/${String(n).padStart(2, "0")}.webp`;

/** The chibi sticker of the comic section (transparent webp). */
export const CHIBI = `${IMG}/comic-chibi.webp`;

/** Every video of the page: a file, its poster, a title and a length in seconds. */
export type VideoName =
  | "splash-short"
  | "final"
  | "final-1080"
  | "final2"
  | "final2-loop"
  | "skin-showcase"
  | "comic-jp"
  | "live-vexana"
  | "heart-dance"
  | "3d-process"
  | "interactive-drama"
  | "skill-passive"
  | "skill-1"
  | "skill-2"
  | "skill-3";

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

export const videoFile = (n: VideoName, ext = "mp4") => `${VID}/${n}.${ext}`;
export const videoPoster = (n: VideoName) => `${VID}/${n}-poster.webp`;

/** The shape the site's player wants, for a video of this page (one source, or a list for sizes). */
export function playerVideo(
  n: VideoName,
  title: string,
  sources: PlayerVideo["sources"],
): PlayerVideo {
  return { sources, poster: videoPoster(n), title };
}

/**
 * The two films for the site's player, in two sizes for its quality menu (21:9, so the heights are
 * 1080 and 810). `final` is the Reel and the top of the page, `final2` the cover section.
 */
export const FINAL_SOURCES = [
  { label: "1080p", height: 1080, src: videoFile("final") },
  { label: "810p", height: 810, src: videoFile("final-1080") },
] as const;
