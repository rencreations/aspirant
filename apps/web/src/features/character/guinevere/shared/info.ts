/**
 * What the lower sections know about the page's videos: lengths, shapes and titles. The files and
 * their measures come from `../videos.ts`.
 */
import type { VideoName } from "../media";
import { VIDEOS } from "../videos";

export interface VideoView {
  name: VideoName;
  src: string;
  poster: string;
  /** Seconds. */
  duration: number;
  /** Width over height of the picture. */
  ratio: number;
  /** Pixel height of the file, for the player's size list. */
  height: number;
}

export function videoInfo(name: VideoName): VideoView {
  const v = VIDEOS[name];
  return {
    name,
    src: v.file,
    poster: v.poster,
    duration: v.duration,
    ratio: v.width / v.height,
    height: v.height,
  };
}
