import { loadMedia } from "@/lib/media-store";
import { imageItem, type PreloadItem } from "@/lib/preload";

import { SKILL_CLIPS } from "./clips.generated";
import { SKILLS, type ClipId } from "./skills-data";

export const skillClipPath = (id: ClipId) => `/video/selena/skills/${id}.mp4`;
export const skillPosterPath = (id: ClipId) => `/video/selena/skills/${id}.webp`;
export const skillIconPath = (icon: string) => `/img/selena/skills/${icon}.webp`;

const CLIP_IDS = Object.keys(SKILL_CLIPS) as ClipId[];

/** The icons, the posters and every clip of the Skills page, for the loading bar. */
export function skillItems(): PreloadItem[] {
  return [
    ...SKILLS.map((s) => imageItem(skillIconPath(s.icon), "Loading the skill icons", 1)),
    ...CLIP_IDS.map((id) => imageItem(skillPosterPath(id), "Loading the skill clips", 1)),
    ...CLIP_IDS.map((id) => ({
      id: `media:${skillClipPath(id)}`,
      label: "Loading the skill clips",
      weight: Math.max(1, Math.round(SKILL_CLIPS[id].bytes / 1_000_000)),
      timeoutMs: 60_000,
      run: (report: (fraction: number) => void) =>
        loadMedia(skillClipPath(id), {
          type: "video/mp4",
          expectedBytes: SKILL_CLIPS[id].bytes,
          onFraction: report,
        }),
    })),
  ];
}
