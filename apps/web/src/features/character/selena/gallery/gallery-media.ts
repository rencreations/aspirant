import { autoQuality } from "@/components/video-player/player-math";
import { imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import {
  FAN_ART,
  galleryImagePath,
  galleryPosterPath,
  galleryThumbPath,
  galleryVideoPath,
  JLEN_POSTS,
  OFFICIAL,
  TIKTOKS,
} from "./gallery-data";
import { GALLERY_IMAGES, GALLERY_TRAILER, GALLERY_VIDEOS } from "./gallery-media.generated";

/**
 * The trailer "Day of Enders" (3 minutes). The player's quality menu offers the 810p file made for
 * this page and the 540p file of the collection.
 */
export const DAY_OF_ENDERS = {
  poster: "/img/selena/gallery/official-day-of-enders.webp",
  captions: "/video/selena-obsidia/trailer.vtt",
  title: "Day of Enders, trailer",
  duration: Math.round(GALLERY_TRAILER.seconds),
  sources: [
    { label: "810p", height: 810, src: "/video/selena/trailer-day-of-enders-810.mp4" },
    { label: "540p", height: 540, src: "/video/selena-obsidia/trailer.mp4" },
  ],
} as const;

const ART_IDS = [OFFICIAL, ...FAN_ART, ...JLEN_POSTS].flatMap((g) => g.pieces.map((p) => p.id));

/**
 * The trailer in the size "Auto" would pick for this screen, so the player opens at once. The
 * other size streams if it is chosen.
 */
function trailerItem(): PreloadItem {
  const pick = autoQuality(DAY_OF_ENDERS.sources, {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  });
  // The trailer is not needed to open the page (the player streams it if it is not here yet), so a
  // slow connection waits for it a minute at most.
  return mediaItem(pick.src, "Loading the Gallery", { type: "video/mp4", timeoutMs: 60_000 });
}

/**
 * What the Gallery needs, for the loading bar: every thumbnail, every picture in full (so the
 * viewer opens at once), the posters, the two TikToks and the trailer.
 */
export function galleryItems(): PreloadItem[] {
  const label = "Loading the Gallery";
  return [
    ...ART_IDS.map((id) => imageItem(galleryThumbPath(id), label, 1)),
    ...ART_IDS.map((id) =>
      mediaItem(galleryImagePath(id), label, {
        type: "image/webp",
        bytes: GALLERY_IMAGES[id].bytes,
        weight: 1,
        timeoutMs: 60_000,
      }),
    ),
    ...TIKTOKS.flatMap(({ id }) => [
      imageItem(galleryPosterPath(id), label, 1),
      mediaItem(galleryVideoPath(id), label, {
        type: "video/mp4",
        bytes: GALLERY_VIDEOS[id].bytes,
        timeoutMs: 120_000,
      }),
    ]),
    imageItem(DAY_OF_ENDERS.poster, label, 1),
    ...(typeof window === "undefined" ? [] : [trailerItem()]),
  ];
}
