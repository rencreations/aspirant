import { videoRoute } from "../video/links";
import type { VideoRoom } from "../types";

/** One half of the Video cover: a room of the Video collection. */
export interface VideoHalf {
  room: VideoRoom;
  /** The small mono line on the cover, above the name (says it is part of Video). */
  index: string;
  name: string;
  /** One line under the half on the shelf and on `/collection/video`. */
  line: string;
  /** Field colour of the half's picture. */
  colour: string;
  /** Key of the 1024 square picture (made by `scripts/library/covers.py`). */
  cover: string;
  href: ReturnType<typeof videoRoute>;
}

/**
 * The two rooms inside the Video cover, in the order they open: Films is the inside of the front
 * panel (on the left, or on top on a phone), Others the inside of the back panel. The colours and
 * keys are read by `scripts/library/covers.py` (keep the `colour: "#rrggbb"` form).
 */
export const VIDEO_HALVES: readonly [VideoHalf, VideoHalf] = [
  {
    room: "films",
    index: "02.1  VIDEO",
    name: "Films",
    line: "The ten official films, one by one.",
    colour: "#111a3f",
    cover: "covers/video-films.webp",
    href: videoRoute("films"),
  },
  {
    room: "others",
    index: "02.2  VIDEO",
    name: "Others",
    line: "Every other video, easy to browse.",
    colour: "#2a5bff",
    cover: "covers/video-others.webp",
    href: videoRoute("others"),
  },
];

/** The shelf slot that splits. */
export const VIDEO_SLUG = "video";

/** Films is always the ten films of `FILM_IDS`; Others is the rest of the Video total. */
export function halfCounts(
  total: number | undefined,
  films: number,
  rooms?: Partial<Record<VideoRoom, number>>,
): [number | undefined, number | undefined] {
  const f = rooms?.films ?? films;
  const o = rooms?.others ?? (typeof total === "number" && total >= f ? total - f : undefined);
  return [f, o];
}
