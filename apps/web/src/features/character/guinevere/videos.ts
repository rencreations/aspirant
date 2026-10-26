/**
 * What the sections know about every video of her page: her own (`media.generated.ts`) and the four
 * that are the same on Vexana's page (her generated file, `scripts/vexana/build.py`).
 */
import { VIDEOS as VEXANA_VIDEOS } from "../vexana/media.generated";
import type { VideoInfo, VideoName } from "./media";
import { OWN_VIDEOS } from "./media.generated";

export const VIDEOS: Record<VideoName, VideoInfo> = {
  ...OWN_VIDEOS,
  final: VEXANA_VIDEOS.final,
  "final-1080": VEXANA_VIDEOS["final-1080"],
  final2: VEXANA_VIDEOS.final2,
  "heart-dance": VEXANA_VIDEOS["heart-dance"],
};
