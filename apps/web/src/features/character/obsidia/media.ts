import { autoQuality } from "@/components/video-player/player-math";
import { imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

import { createStageMedia } from "../stage/media";
import { OBSIDIA_BYTES, OBSIDIA_TIERS } from "./timeline.generated";

const OBSIDIA_DIR = "/video/obsidia";

/** Choosing, loading and addressing her videos (see `stage/media.ts`). */
export const obsidiaMedia = createStageMedia({
  id: "obsidia",
  name: "Obsidia",
  dir: OBSIDIA_DIR,
  tiers: OBSIDIA_TIERS,
  bytes: OBSIDIA_BYTES,
  tierNames: { lite: "light", "1080": "HD", "1440": "QHD", "2160": "4K" },
  // The size of the source recordings, for the cover maths.
  source: { width: 3840, height: 1728 },
  // The first load is the welcome and the idle loop. The page clips and the shorts follow it.
  deferRest: true,
  // The "Day of Enders" film of her gallery is Selena's file, shared by the pair.
  alsoRelease: ["/video/selena/trailer-day-of-enders"],
});

export const { pickTier, loadCore } = obsidiaMedia;
export const obsidiaItems = obsidiaMedia.items;

/** Her stickers on the page buttons, and her weapon on Back (`scripts/obsidia/sticker-assets.py`). */
export const MENU_ICON = {
  about: "/img/obsidia/btn/about.webp",
  skills: "/img/obsidia/btn/skills.webp",
  gallery: "/img/obsidia/btn/gallery.webp",
  weapon: "/img/obsidia/btn/weapon.webp",
} as const;

/** The pictures her interface is drawn with (the eclipse, the thorns, the texture of the drawers). */
export const OBSIDIA_UI_IMAGES: readonly string[] = [
  ...Object.values(MENU_ICON),
  "/img/obsidia/ui/eclipse.webp",
  "/img/obsidia/ui/corner.webp",
  "/img/obsidia/ui/veins.webp",
];

/** Her theme, which plays and loops while her page is open. */
export const OBSIDIA_MUSIC = "/audio/music/obsidia-theme.m4a";

/** Her trailer, in three sizes for the player's quality menu (60 fps, like the stage). */
export const TRAILER = {
  poster: "/video/obsidia/trailer-poster.webp",
  title: "Obsidia, The Queen's Endgame",
  duration: 80,
  sources: [
    { label: "1080p", height: 1080, src: "/video/obsidia/trailer-1080.mp4" },
    { label: "720p", height: 720, src: "/video/obsidia/trailer-720.mp4" },
    { label: "480p", height: 480, src: "/video/obsidia/trailer-480.mp4" },
  ],
} as const;

/** The colours of her player: the ink of her plates, a gold keyline and a rose accent. */
export const TRAILER_SKIN = { ink: "#14060d", keyline: "#e2b04a", accent: "#ff5a86" } as const;

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

/** Her voice lines (`public/audio/voice/obsidia/NN.m4a`), for the About page. */
export const OBSIDIA_VOICE_COUNT = 41;
export const obsidiaVoicePath = (n: number) =>
  `/audio/voice/obsidia/${String(n).padStart(2, "0")}.m4a`;

/**
 * The two forms in About: a silent clip and a photo each (60 fps like the stage). The Ender one is
 * her transformation in the Pawn's Gambit trailer, the normal one is cut from her own trailer.
 * `scripts/obsidia/forms-assets.py` makes them.
 */
export const FORM_NAMES = ["normal", "ender"] as const;
export const FORMS = {
  normal: {
    title: "Obsidia, normal form",
    poster: "/img/obsidia/form-normal.webp",
    src: "/video/obsidia/forms/form-normal.mp4",
    label: "960p",
    height: 960,
    duration: 15.9,
  },
  ender: {
    title: "Obsidia, Ender form, the transformation",
    poster: "/img/obsidia/form-ender.webp",
    src: "/video/obsidia/forms/form-ender.mp4",
    label: "743p",
    height: 743,
    duration: 10.8,
  },
} as const;

/** The photos and the clips of the two forms, for the loading bar. */
export function formItems(): PreloadItem[] {
  return FORM_NAMES.flatMap((f) => [
    imageItem(FORMS[f].poster, "Loading the two forms", 1),
    mediaItem(FORMS[f].src, "Loading the two forms", { type: "video/mp4", timeoutMs: 120_000 }),
  ]);
}
