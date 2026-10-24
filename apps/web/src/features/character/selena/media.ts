import { autoQuality } from "@/components/video-player/player-math";
import { mediaItem, type PreloadItem } from "@/lib/preload";

import { createStageMedia } from "../stage/media";
import { SELENA_BYTES, SELENA_TIERS } from "./timeline.generated";

const SELENA_DIR = "/video/selena";

/** Her pictures on the three page buttons. */
export const MENU_ICON = {
  about: "/img/selena/btn/about.webp",
  skills: "/img/selena/btn/skills.webp",
  gallery: "/img/selena/btn/gallery.webp",
  /** The Silverbolt, on the Back button. */
  back: "/img/selena/btn/silverbolt.webp",
} as const;

/** Choosing, loading and addressing her videos (see `stage/media.ts`). */
export const selenaMedia = createStageMedia({
  id: "selena",
  name: "Selena",
  dir: SELENA_DIR,
  tiers: SELENA_TIERS,
  bytes: SELENA_BYTES,
  tierNames: { lite: "light", "1080": "HD", "1440": "QHD", "2160": "4K" },
  // The first load is the welcome and the idle loop. The page clips and the shorts follow it.
  deferRest: true,
  // The size of the source recordings, for the cover maths.
  source: { width: 3840, height: 1728 },
});

export const { pickTier, loadCore } = selenaMedia;
export const selenaItems = selenaMedia.items;

/** The trailer on her page, in three sizes for the player's quality menu. */
export const TRAILER = {
  poster: "/video/selena/trailer-poster.webp",
  title: "Selena, trailer",
  duration: 69,
  sources: [
    { label: "1080p", height: 1080, src: "/video/selena/trailer-1080.mp4" },
    { label: "720p", height: 720, src: "/video/selena/trailer-720.mp4" },
    { label: "480p", height: 480, src: "/video/selena/trailer-480.mp4" },
  ],
} as const;

/**
 * The trailer in the size "Auto" would pick for this screen (the player fills the screen), so the
 * player opens at once with no download. The other sizes stream when they are chosen.
 */
export function trailerItem(): PreloadItem {
  const pick = autoQuality(TRAILER.sources, {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  });
  return mediaItem(pick.src, "Loading the trailer", { type: "video/mp4", timeoutMs: 180_000 });
}

/** Her voice lines (`public/audio/voice/selena/NN.m4a`), for the About page. */
export const SELENA_VOICE_COUNT = 46;
export const selenaVoicePath = (n: number) =>
  `/audio/voice/selena/${String(n).padStart(2, "0")}.m4a`;
