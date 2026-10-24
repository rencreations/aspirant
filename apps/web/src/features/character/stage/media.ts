import { loadMedia } from "@/lib/media-store";
import { onPerfLevel, perfLevel, perfReady, type PerfLevel } from "@/lib/perf";
import type { PreloadItem } from "@/lib/preload";

export interface DisplayInfo {
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
  /** The performance level of the device (see `lib/perf.ts`). Default `full`. */
  level?: PerfLevel;
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
}

/**
 * Everything about choosing, loading and addressing the videos of one character's stage. The
 * tiers are named by their width (`lite`, `1080`, `1440`, `2160`): the smallest is the light one
 * (half the frame rate), `1080` is where a device that has to go easy stops, `1440` is where a
 * touch device stops.
 */
export function createStageMedia<T extends string>(cfg: StageMediaConfig<T>) {
  /** The tiers, smallest first. (Object keys that look like numbers come first, so sort by width.) */
  const tierIds = (Object.keys(cfg.tiers) as T[]).sort(
    (a, b) => cfg.tiers[a].width - cfg.tiers[b].width,
  );
  const index = (id: string) => tierIds.indexOf(id as T);
  const named = (id: string) => tierIds.find((t) => t === id);

  /**
   * The size of video for this display and this device. The picture covers the screen, so a video
   * as wide as the picture appears in device pixels is as sharp as it can be, and a tier is taken
   * when it reaches 82 percent of that (76 percent for 2560 and above) (a little softness is better than a much bigger download).
   * Then the device holds it back:
   *
   *  - the performance level: `lite` is the smallest tier (half the frame rate), `balanced` is at
   *    most 1080;
   *  - touch devices stop at 1440, and with little memory at 1080; data saving and very little
   *    memory get the smallest.
   */
  function pickTier(d: DisplayInfo): T {
    if (d.level === "lite" || d.saveData || (d.memory !== undefined && d.memory <= 2)) {
      return tierIds[0]!;
    }
    const cover = Math.max(d.width / cfg.source.width, d.height / cfg.source.height);
    const need = cfg.source.width * cover * d.dpr;
    // A size of 2560 or more is taken when it reaches 76 percent of the need: a QHD screen, or a full
    // HD one with a little scaling, gets the 2560 picture and not the 4K one (a third of the bytes,
    // and much easier to decode at 60 frames a second).
    const enough = (id: T) =>
      cfg.tiers[id].width >= need * (cfg.tiers[id].width >= 2560 ? 0.76 : 0.82);
    let tier = tierIds.find(enough) ?? tierIds.at(-1)!;
    const cap = (max: string) => {
      const m = named(max);
      if (m && index(tier) > index(m)) tier = m;
    };
    if (d.touch) cap("1440");
    if (d.touch && d.memory !== undefined && d.memory <= 4) cap("1080");
    if (d.level === "balanced") cap("1080");
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
      touch: window.matchMedia("(pointer: coarse)").matches,
      level: perfLevel(),
    };
  }

  /**
   * The size for this visit, so the loading bar and the page agree. It follows the performance
   * level: when the device steps down, the next video that is attached is of the smaller size.
   */
  let chosen: T | null = null;
  let following = false;
  function tier(): T {
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
  function tierReady(): Promise<T> {
    return perfReady().then(() => {
      chosen = pickTier(currentDisplay());
      return chosen;
    });
  }

  const path = (t: string, file: string) => `${cfg.dir}/${t}/${file}`;

  /** Every video of the page in the chosen size, for the loading bar (weighted by bytes). */
  function items(options: { page?: string } = {}): PreloadItem[] {
    // The weights follow the size that suits the display. The files loaded are those of the size
    // the device can decode (`tierReady`), which is the same unless the device is slower.
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
        timeoutMs: 120_000,
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

  return { dir: cfg.dir, pickTier, tier, path, items, loadCore };
}

/** What the stage needs of a character's media: where a video of a size is. */
export interface StageMedia {
  dir: string;
  tier: () => string;
  path: (tier: string, file: string) => string;
}
