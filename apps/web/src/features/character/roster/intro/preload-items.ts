import { chunkItem, imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { INTRO_CLIPS } from "./clips";
import { introMode } from "./mode";
import { OBSIDIA_CUTOUT, STILL_NAMES, STILLS } from "./stills";

/** The order the panels need their clips in, so the first ones arrive first. */
const CLIP_ORDER = [
  "fanny",
  "ruby",
  "layla",
  "change",
  "angela",
  "lesley",
  "guinevere",
  "vexana",
  "selena",
  "obsidia",
] as const;

/**
 * What the intro of `/character` needs at first paint: its code, the cleaned stills of the beam
 * and the fire, and the ten welcome clips (held whole in memory, with the bytes counted). A visitor
 * who will not see the intro (reduced motion, no WebGL, `?intro=off`) loads none of it, and the
 * lite level loads no clips.
 */
export function introItems(): PreloadItem[] {
  const mode = introMode();
  if (mode === "off") return [];
  const items: PreloadItem[] = [
    chunkItem("roster-intro", "Loading the opening", () => import("./roster-intro"), 2),
    ...STILL_NAMES.map((n) => imageItem(STILLS[n].path, "Loading the opening effects", 1)),
    imageItem(OBSIDIA_CUTOUT, "Loading the opening effects", 1),
  ];
  if (mode === "full") {
    for (const slug of CLIP_ORDER) {
      items.push(
        mediaItem(INTRO_CLIPS[slug].src, "Loading the opening", {
          type: "video/mp4",
          weight: 1,
          timeoutMs: 30_000,
        }),
      );
    }
  }
  return items;
}
