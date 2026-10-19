import { loadMedia } from "@/lib/media-store";
import { imageItem, type PreloadItem } from "@/lib/preload";

import { SKILL_CLIPS } from "./clips.generated";
import { SKILLS, type ClipId } from "./skills-data";

export const skillClipPath = (id: ClipId) => `/video/selena/skills/${id}.mp4`;
/** The small silent loop shown next to the list. The full clip (with sound) opens in the player. */
export const skillSmallPath = (id: ClipId) => `/video/selena/skills/${id}-s.mp4`;
export const skillPosterPath = (id: ClipId) => `/video/selena/skills/${id}.webp`;
export const skillIconPath = (icon: string) => `/img/selena/skills/${icon}.webp`;

const CLIP_IDS = Object.keys(SKILL_CLIPS) as ClipId[];

function clipItem(path: string, bytes: number): PreloadItem {
  return {
    id: `media:${path}`,
    label: "Loading the skill clips",
    weight: Math.max(1, Math.round(bytes / 1_000_000)),
    timeoutMs: 120_000,
    memo: false,
    run: (report) =>
      loadMedia(path, { type: "video/mp4", expectedBytes: bytes, onFraction: report }),
  };
}

/** The icons, the posters and every clip of the Skills page, for the loading bar. */
export function skillItems(): PreloadItem[] {
  return [
    ...SKILLS.map((s) => imageItem(skillIconPath(s.icon), "Loading the skill icons", 1)),
    ...CLIP_IDS.map((id) => imageItem(skillPosterPath(id), "Loading the skill clips", 1)),
    ...CLIP_IDS.flatMap((id) => [
      clipItem(skillSmallPath(id), SKILL_CLIPS[id].smallBytes),
      clipItem(skillClipPath(id), SKILL_CLIPS[id].bytes),
    ]),
  ];
}
