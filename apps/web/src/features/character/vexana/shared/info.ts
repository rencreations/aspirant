/**
 * What the lower sections know about the page's videos and comic pages: lengths, shapes and
 * titles. The files and their measures come from `../media.generated.ts` (written by the build).
 */
import { COMIC_PAGES, IMAGES, VIDEOS } from "../media.generated";
import type { VideoName } from "../media";

export interface VideoView {
  name: VideoName;
  src: string;
  poster: string;
  /** Seconds. */
  duration: number;
  /** Width over height of the picture. */
  ratio: number;
  /** Pixel height of the file, for the player's size list. */
  height: number;
}

export function videoInfo(name: VideoName): VideoView {
  const v = VIDEOS[name];
  return {
    name,
    src: v.file,
    poster: v.poster,
    duration: v.duration,
    ratio: v.width / v.height,
    height: v.height,
  };
}

/**
 * The height over the width of each comic page, measured from the source files (width 2500). It is
 * what keeps a page's box the right shape before its picture arrives. The build's own measure wins
 * when it has one.
 */
const SOURCE_TALL: Record<number, number> = {
  1: 4396,
  2: 2074,
  4: 3632,
  5: 3573,
  6: 4924,
  7: 2593,
  8: 3767,
  9: 5149,
  10: 5967,
  11: 6315,
  12: 3091,
  13: 7727,
  14: 4807,
  15: 8429,
  16: 3988,
  17: 4613,
  18: 3964,
  19: 4979,
  20: 3788,
  21: 4249,
  22: 5704,
  24: 1992,
  25: 4149,
  26: 2618,
  27: 4926,
  28: 3765,
  29: 3711,
  30: 2293,
  31: 3894,
  32: 2451,
  33: 4581,
  34: 2145,
  35: 2971,
  36: 3715,
  37: 2711,
  38: 4390,
  39: 6866,
  41: 5655,
  42: 6509,
  43: 5102,
  44: 7043,
  45: 3714,
  46: 3366,
};

export interface ComicSlot {
  /** The original page number. */
  n: number;
  /** Height over width, or null when this page was never supplied. */
  tall: number | null;
}

function tallOf(n: number): number | null {
  if (!COMIC_PAGES.includes(n)) return null;
  const built = IMAGES[`comic/${String(n).padStart(2, "0")}`];
  if (built) return built.height / built.width;
  const source = SOURCE_TALL[n];
  return source ? source / 2500 : 1.8;
}

/** Every number from 1 to the last page, with the gaps kept (3, 23 and 40 were never supplied). */
export const COMIC_SLOTS: readonly ComicSlot[] = Array.from(
  { length: Math.max(...COMIC_PAGES) },
  (_, i) => ({ n: i + 1, tall: tallOf(i + 1) }),
);

export const COMIC_COUNT = COMIC_PAGES.length;
/** The pages were cut at about this width, only the ratio matters. */
export const COMIC_W = 2500;
