import { loadMedia } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";

export interface DisplayInfo {
  /** Viewport in CSS pixels. */
  width: number;
  height: number;
  /** Device pixel ratio. */
  dpr: number;
}

export interface StageMediaConfig<T extends string> {
  /** Short name used in the ids of the loading items (`media:selena:idle.mp4`). */
  id: string;
  /** Her name, for the label of the loading bar. */
  name: string;
  /** Where her videos are (`/video/selena`): one folder per tier, then the files. */
  dir: string;
  /** The sizes the videos exist in. `width` is the video width in pixels. */
  tiers: Record<T, { width: number }>;
  /** Size in bytes of every file in every tier. */
  bytes: Record<T, Record<string, number>>;
  /** What the loading bar calls each size. */
  tierNames: Record<T, string>;
  /** The size of the source recordings, for the cover maths. */
  source: { width: number; height: number };
  /**
   * Load only the idle loop and the welcome before the page opens, and the rest (the page clips,
   * the shorts) in the background after it. Without it everything is loaded first.
   */
  deferRest?: boolean;
  /**
   * Files of another folder that this page loads too (a film shared with its pair). They are let go
   * with the page, so they do not sit in memory after it has been left.
   */
  alsoRelease?: readonly string[];
}

/**
 * Everything about choosing, loading and addressing the videos of one character's stage. The
 * tiers are named by their width (`1080`, `1440`, `2160`). The size is chosen by the display and
 * nothing else: the device and the connection never lower it. (A tier named `lite`, the old
 * half-rate cut, still exists on disk for some pages and is never chosen.)
 */
export function createStageMedia<T extends string>(cfg: StageMediaConfig<T>) {
  /** The tiers, smallest first. (Object keys that look like numbers come first, so sort by width.) */
  const tierIds = (Object.keys(cfg.tiers) as T[])
    .filter((id) => id !== "lite")
    .sort((a, b) => cfg.tiers[a].width - cfg.tiers[b].width);

  /**
   * The size of video for this display. The picture covers the screen, so a video as wide as the
   * picture appears in device pixels is as sharp as it can be, and a tier is taken when it reaches
   * 82 percent of that (76 percent for 2560 and above): a little softness is better than a much
   * bigger download. A slow connection waits behind the loading screen for it.
   */
  function pickTier(d: DisplayInfo): T {
    const cover = Math.max(d.width / cfg.source.width, d.height / cfg.source.height);
    const need = cfg.source.width * cover * d.dpr;
    // A size of 2560 or more is taken when it reaches 76 percent of the need: a QHD screen, or a full
    // HD one with a little scaling, gets the 2560 picture and not the 4K one (a third of the bytes).
    const enough = (id: T) =>
      cfg.tiers[id].width >= need * (cfg.tiers[id].width >= 2560 ? 0.76 : 0.82);
    return tierIds.find(enough) ?? tierIds.at(-1)!;
  }

  /** Read the current display (browser only). */
  function currentDisplay(): DisplayInfo {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    };
  }

  /** The size for this visit, so the loading bar and the page agree. */
  let chosen: T | null = null;
  function tier(): T {
    chosen ??= pickTier(currentDisplay());
    return chosen;
  }

  /** Resolves with the size for this visit. Everything that loads or plays the videos waits for it. */
  function tierReady(): Promise<T> {
    chosen = pickTier(currentDisplay());
    return Promise.resolve(chosen);
  }

  const path = (t: string, file: string) => `${cfg.dir}/${t}/${file}`;

  /** Every video of the page in the chosen size, for the loading bar (weighted by bytes). */
  function items(options: { page?: string } = {}): PreloadItem[] {
    const t = tier();
    // The videos the stage starts with come first, so they arrive first.
    const first = (file: string) => (file === "idle.mp4" ? 0 : file === "welcome.mp4" ? 1 : 2);
    const files = Object.entries(cfg.bytes[t]).sort((a, b) => first(a[0]) - first(b[0]));
    // What is wanted first of the rest: the entrances and the shorts (a press needs them at once),
    // then the page loops (the entrance hands over to them a few seconds later), then the exits.
    const priority = (file: string) =>
      file.endsWith("-loop.mp4") ? 11 : file.endsWith("-out.mp4") ? 12 : 10;
    return files.map(([file, size]) => {
      // The page the visitor landed on needs its own clips at once.
      const later =
        cfg.deferRest === true &&
        file !== "idle.mp4" &&
        file !== "welcome.mp4" &&
        !(options.page && file.startsWith(`${options.page}-`));
      return {
        id: `media:${cfg.id}:${file}`,
        label:
          file === "welcome.mp4"
            ? "Loading the welcome animation"
            : `Loading ${cfg.name} in ${cfg.tierNames[t]}`,
        weight: Math.max(1, Math.round(size / 1_000_000)),
        memo: false,
        deferred: later,
        priority: priority(file),
        group: cfg.id,
        run: async (report) => {
          const use = await tierReady();
          return loadMedia(path(use, file), {
            type: "video/mp4",
            expectedBytes: cfg.bytes[use][file] ?? size,
            onFraction: report,
            background: later,
          });
        },
      };
    });
  }

  /**
   * The videos the stage needs at its very first frame: the idle loop, and the welcome unless it
   * is skipped. The stage waits for them (they come from memory, from the saved copy, or from the
   * network, whichever is first), so it never starts on a plain address while the file it needs
   * is being loaded. Whatever else is missing is loaded in the background.
   */
  async function loadCore(welcome: boolean): Promise<void> {
    const t = await tierReady();
    const files = welcome ? ["idle.mp4", "welcome.mp4"] : ["idle.mp4"];
    await Promise.all(
      files.map((file) =>
        loadMedia(path(t, file), {
          type: "video/mp4",
          expectedBytes: cfg.bytes[t][file],
        }),
      ),
    );
  }

  /** What is let go when the page is left: her folder, and whatever else she loaded. */
  const release = [`${cfg.dir}/`, ...(cfg.alsoRelease ?? [])];

  return { dir: cfg.dir, release, pickTier, tier, tierReady, path, items, loadCore };
}

/** What the stage needs of a character's media: where a video of a size is. */
export interface StageMedia {
  dir: string;
  /** Prefixes of what is let go when the page is left (`dir` and anything shared). */
  release?: readonly string[];
  tier: () => string;
  path: (tier: string, file: string) => string;
}
