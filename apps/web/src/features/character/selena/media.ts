import { autoQuality } from "@/components/video-player/player-math";
import { loadMedia } from "@/lib/media-store";
import { mediaItem, type PreloadItem } from "@/lib/preload";

import { SELENA_BYTES, SELENA_TIERS, type SelenaTier } from "./timeline.generated";

export const SELENA_DIR = "/video/selena";

/** Her pictures on the three page buttons. */
export const MENU_ICON = {
  about: "/img/selena/btn/about.webp",
  skills: "/img/selena/btn/skills.webp",
  gallery: "/img/selena/btn/gallery.webp",
} as const;

const TIER_IDS = Object.keys(SELENA_TIERS) as SelenaTier[];

/** The size of the source recordings, for the cover maths. */
const SRC_W = 3840;
const SRC_H = 1728;

interface DisplayInfo {
  /** Viewport in CSS pixels. */
  width: number;
  height: number;
  /** Device pixel ratio. */
  dpr: number;
  /** The visitor asked for less data. */
  saveData?: boolean;
  /** GB of memory the device reports (Chrome only). */
  memory?: number;
  /** A touch-first device: phones and tablets. */
  touch?: boolean;
}

/**
 * The size of video worth loading for this display. The picture covers the screen, so the video
 * has to be as wide as it appears in device pixels. A tier is chosen when it reaches 82 percent
 * of that (a little softness is better than a download twice the size). Touch devices stop at
 * 1440, and low-memory or data-saving visitors get the smallest.
 */
export function pickTier(d: DisplayInfo): SelenaTier {
  if (d.saveData || (d.memory !== undefined && d.memory <= 2)) return "1080";
  const cover = Math.max(d.width / SRC_W, d.height / SRC_H);
  const need = SRC_W * cover * d.dpr;
  let tier =
    TIER_IDS.find((id) => SELENA_TIERS[id].width >= need * 0.82) ?? TIER_IDS[TIER_IDS.length - 1]!;
  if (d.touch && tier === "2160") tier = "1440";
  if (d.touch && d.memory !== undefined && d.memory <= 4) tier = "1080";
  return tier;
}

/** Read the current display (browser only). */
function currentDisplay(): DisplayInfo {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    saveData: nav.connection?.saveData === true,
    memory: nav.deviceMemory,
    touch: window.matchMedia("(pointer: coarse)").matches,
  };
}

/** Chosen once per visit, so the loading bar and the page agree on the size. */
let chosen: SelenaTier | null = null;
export function selenaTier(): SelenaTier {
  chosen ??= pickTier(currentDisplay());
  return chosen;
}

/**
 * The biggest size at or below `wanted` that `decodes` says plays smoothly. The picture is kept as
 * big as the device can show: only a size it cannot decode at 60 frames a second is left out, and
 * the next one down is used. The smallest is the last resort.
 */
export async function limitTier(
  wanted: SelenaTier,
  decodes: (tier: SelenaTier) => Promise<boolean>,
): Promise<SelenaTier> {
  for (let i = TIER_IDS.indexOf(wanted); i > 0; i--) {
    if (await decodes(TIER_IDS[i]!)) return TIER_IDS[i]!;
  }
  return TIER_IDS[0]!;
}

/** The H.264 profile and level each size is encoded at (High 4.2, High 5.1, High 5.2). */
const TIER_CODEC: Record<SelenaTier, string> = {
  "1080": 'video/mp4; codecs="avc1.64002a"',
  "1440": 'video/mp4; codecs="avc1.640033"',
  "2160": 'video/mp4; codecs="avc1.640034"',
};

/** Ask the browser whether a size plays smoothly on this device (no answer counts as yes). */
async function browserDecodes(tier: SelenaTier): Promise<boolean> {
  try {
    const caps = navigator.mediaCapabilities;
    if (!caps?.decodingInfo) return true;
    const width = SELENA_TIERS[tier].width;
    const info = await caps.decodingInfo({
      type: "file",
      video: {
        contentType: TIER_CODEC[tier],
        width,
        height: Math.round(width * (SRC_H / SRC_W)),
        bitrate: 10_000_000,
        framerate: 60,
      },
    });
    return info.supported && info.smooth;
  } catch {
    return true;
  }
}

let ready: Promise<SelenaTier> | null = null;

/**
 * Settles the size for this visit: the one that suits the display, held back to what the device
 * can decode smoothly. Everything that loads or plays the videos waits for it, so they all use
 * the same size.
 */
function selenaTierReady(): Promise<SelenaTier> {
  ready ??= limitTier(selenaTier(), browserDecodes).then((tier) => {
    chosen = tier;
    return tier;
  });
  return ready;
}

export const selenaPath = (tier: SelenaTier, file: string) => `${SELENA_DIR}/${tier}/${file}`;

const TIER_NAME: Record<SelenaTier, string> = { "1080": "HD", "1440": "QHD", "2160": "4K" };

/** Every video of the page in the chosen size, for the loading bar (weighted by bytes). */
export function selenaItems(): PreloadItem[] {
  // The weights follow the size that suits the display. The files loaded are those of the size
  // the device can decode (`selenaTierReady`), which is the same unless the device is slower.
  const tier = selenaTier();
  // The videos the stage starts with come first, so they arrive first.
  const first = (file: string) => (file === "idle.mp4" ? 0 : file === "welcome.mp4" ? 1 : 2);
  const files = Object.entries(SELENA_BYTES[tier]).sort((a, b) => first(a[0]) - first(b[0]));
  return files.map(([file, size]) => ({
    id: `media:selena:${file}`,
    label:
      file === "welcome.mp4"
        ? "Loading the welcome animation"
        : `Loading Selena in ${TIER_NAME[tier]}`,
    weight: Math.max(1, Math.round(size / 1_000_000)),
    timeoutMs: 120_000,
    memo: false,
    run: async (report) => {
      const use = await selenaTierReady();
      return loadMedia(selenaPath(use, file), {
        type: "video/mp4",
        expectedBytes: SELENA_BYTES[use][file] ?? size,
        onFraction: report,
      });
    },
  }));
}

/**
 * The videos the stage needs at its very first frame: the idle loop, and the welcome unless it is
 * skipped. The stage waits for them (they come from memory, from the saved copy, or from the
 * network, whichever is first), so it never starts on a plain address while the file it needs
 * is being loaded. Whatever else is missing is loaded in the background.
 */
export async function loadCore(welcome: boolean): Promise<void> {
  const tier = await selenaTierReady();
  const files = welcome ? ["idle.mp4", "welcome.mp4"] : ["idle.mp4"];
  await Promise.all(
    files.map((file) =>
      loadMedia(selenaPath(tier, file), {
        type: "video/mp4",
        expectedBytes: SELENA_BYTES[tier][file],
      }),
    ),
  );
}

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
