import { loadMedia } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";

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

export const selenaPath = (tier: SelenaTier, file: string) => `${SELENA_DIR}/${tier}/${file}`;

const TIER_NAME: Record<SelenaTier, string> = { "1080": "HD", "1440": "QHD", "2160": "4K" };

/** Every video of the page in the chosen size, for the loading bar (weighted by bytes). */
export function selenaItems(): PreloadItem[] {
  const tier = selenaTier();
  return Object.entries(SELENA_BYTES[tier]).map(([file, size]) => ({
    id: `media:${selenaPath(tier, file)}`,
    label:
      file === "welcome.mp4"
        ? "Loading the welcome animation"
        : `Loading Selena in ${TIER_NAME[tier]}`,
    weight: Math.max(1, Math.round(size / 1_000_000)),
    timeoutMs: 120_000,
    run: (report) =>
      loadMedia(selenaPath(tier, file), {
        type: "video/mp4",
        expectedBytes: size,
        onFraction: report,
      }),
  }));
}
