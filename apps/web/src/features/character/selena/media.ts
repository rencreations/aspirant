import { autoQuality } from "@/components/video-player/player-math";
import { loadMedia } from "@/lib/media-store";
import { hasHardwareDecode, onPerfLevel, perfLevel, perfReady, type PerfLevel } from "@/lib/perf";
import { mediaItem, type PreloadItem } from "@/lib/preload";

import { SELENA_BYTES, SELENA_TIERS, type SelenaTier } from "./timeline.generated";

export const SELENA_DIR = "/video/selena";

/** Her pictures on the three page buttons. */
export const MENU_ICON = {
  about: "/img/selena/btn/about.webp",
  skills: "/img/selena/btn/skills.webp",
  gallery: "/img/selena/btn/gallery.webp",
  /** The Silverbolt, on the Back button. */
  back: "/img/selena/btn/silverbolt.webp",
} as const;

/** The tiers, smallest first. (Object keys that look like numbers come first, so sort by width.) */
const TIER_IDS = (Object.keys(SELENA_TIERS) as SelenaTier[]).sort(
  (a, b) => SELENA_TIERS[a].width - SELENA_TIERS[b].width,
);

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
  /** Logical cores. */
  cores?: number;
  /** A touch-first device: phones and tablets. */
  touch?: boolean;
  /** The device decodes video in hardware. Null when it is not known (yet). */
  hardware?: boolean | null;
  /** The performance level of the device (see `lib/perf.ts`). Default `full`. */
  level?: PerfLevel;
}

/**
 * The size of video for this display and this device. The picture covers the screen, so a video
 * as wide as the picture appears in device pixels is as sharp as it can be, and a tier is taken
 * when it reaches 82 percent of that (a little softness is better than a much bigger download).
 * Then the device holds it back:
 *
 *  - the performance level: `lite` is the smallest tier (half the frame rate), `balanced` is at
 *    most 1080;
 *  - touch devices stop at 1440, and with little memory at 1080; data saving and very little
 *    memory get the smallest;
 *  - 4K is only for a device that decodes in hardware and has the cores and the memory for it.
 *    Its stream is H.264 level 5.2 at 60 frames a second, and decoding it in software takes about
 *    two cores.
 */
export function pickTier(d: DisplayInfo): SelenaTier {
  if (d.level === "lite" || d.saveData || (d.memory !== undefined && d.memory <= 2)) {
    return TIER_IDS[0]!;
  }
  const cover = Math.max(d.width / SRC_W, d.height / SRC_H);
  const need = SRC_W * cover * d.dpr;
  const index = (id: SelenaTier) => TIER_IDS.indexOf(id);
  let tier = TIER_IDS.find((id) => SELENA_TIERS[id].width >= need * 0.82) ?? TIER_IDS.at(-1)!;
  const cap = (max: SelenaTier) => {
    if (index(tier) > index(max)) tier = max;
  };
  if (d.touch) cap("1440");
  if (d.touch && d.memory !== undefined && d.memory <= 4) cap("1080");
  if (d.level === "balanced") cap("1080");
  const fourK = d.hardware === true && (d.cores ?? 0) >= 8 && (d.memory ?? 8) >= 8;
  if (!fourK) cap("1440");
  return tier;
}

/** Read the current display and device (browser only). */
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
    cores: nav.hardwareConcurrency,
    touch: window.matchMedia("(pointer: coarse)").matches,
    hardware: hasHardwareDecode(),
    level: perfLevel(),
  };
}

/**
 * The size for this visit, so the loading bar and the page agree. It follows the performance
 * level: when the device steps down, the next video that is attached is of the smaller size.
 */
let chosen: SelenaTier | null = null;
let following = false;
export function selenaTier(): SelenaTier {
  if (!following && typeof window !== "undefined") {
    following = true;
    onPerfLevel(() => {
      chosen = pickTier(currentDisplay());
    });
  }
  chosen ??= pickTier(currentDisplay());
  return chosen;
}

/**
 * Resolves with the size for this visit once the device has been asked (whether it decodes in
 * hardware). Everything that loads or plays the videos waits for it, so they use the same size.
 */
function selenaTierReady(): Promise<SelenaTier> {
  return perfReady().then(() => {
    chosen = pickTier(currentDisplay());
    return chosen;
  });
}

export const selenaPath = (tier: SelenaTier, file: string) => `${SELENA_DIR}/${tier}/${file}`;

const TIER_NAME: Record<SelenaTier, string> = {
  lite: "light",
  "1080": "HD",
  "1440": "QHD",
  "2160": "4K",
};

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
