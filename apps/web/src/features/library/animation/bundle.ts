import { libUrl } from "@/lib/library";
import { loadMedia, type ByteCount } from "@/lib/media-store";
import type { CharacterSlug } from "@/lib/slugs";

import { createStageMedia } from "@/features/character/stage/media";
import type { SkipOptions } from "@/features/character/stage/phase";
import { PAGE_NAMES, SHORT_NAMES, type Timeline } from "@/features/character/stage/timeline";

/** What `createStageMedia` gives back: where a character's videos are, and how they load. */
type StageMediaObject = ReturnType<typeof createStageMedia<string>>;

/** Everything the room needs to run one character's stage. */
export interface StageBundle {
  slug: CharacterSlug;
  timeline: Timeline;
  media: StageMediaObject;
  /** Size in bytes of every file in every size. */
  bytes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** The speed up while the picture waits for a frame, or undefined when the timeline needs none. */
  skip: (() => SkipOptions | null) | undefined;
}

/** The files the stage needs at its first frame. */
export const CORE_FILES = ["welcome.mp4", "idle.mp4"] as const;

const TIER_NAMES: Record<string, string> = {
  lite: "light",
  "1080": "HD",
  "1440": "QHD",
  "2160": "4K",
};

/** The source recordings are 3840 by 1728 for every character. */
const SOURCE = { width: 3840, height: 1728 } as const;

/**
 * The speed up Selena's and Obsidia's pages use while the idle loop waits for the frame a clip
 * starts on. The bigger the picture, the less it can be sped up.
 */
export function timeSkip(media: Pick<StageMediaObject, "tier">): () => SkipOptions {
  return () => {
    const tier = media.tier();
    return { maxRate: tier === "2160" ? 2 : tier === "1440" ? 2.25 : 2.5, minFrames: 70 };
  };
}

/** True when the timeline waits for the loop only a short while (Vexana's and Guinevere's rooms). */
export function hasMaxWait(timeline: Timeline): boolean {
  return SHORT_NAMES.some((s) => timeline.shorts[s].maxWait !== undefined);
}

/** The data a stage builder writes for one character (`stage-data/<slug>.generated.ts`). */
export interface StageData {
  timeline: Timeline;
  tiers: Record<string, { width: number }>;
  bytes: Record<string, Record<string, number>>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function isTimeline(v: unknown): v is Timeline {
  if (!isRecord(v) || typeof v.fps !== "number" || typeof v.loopFrames !== "number") return false;
  const { pages, shorts } = v;
  return (
    isRecord(pages) &&
    isRecord(shorts) &&
    PAGE_NAMES.every((p) => isRecord(pages[p])) &&
    SHORT_NAMES.every((s) => isRecord(shorts[s]))
  );
}

function isTiers(v: unknown): v is Record<string, { width: number }> {
  if (!isRecord(v)) return false;
  const values = Object.values(v);
  return values.length > 0 && values.every((t) => isRecord(t) && typeof t.width === "number");
}

function isBytes(v: unknown): v is Record<string, Record<string, number>> {
  if (!isRecord(v)) return false;
  const tiers = Object.values(v);
  return (
    tiers.length > 0 &&
    tiers.every((t) => isRecord(t) && Object.values(t).every((n) => typeof n === "number")) &&
    tiers.some((t) => isRecord(t) && "idle.mp4" in t)
  );
}

/**
 * Read a generated stage data module whatever it names its exports: the timeline, the sizes and the
 * byte table are told apart by their shape. Null when one of the three is missing.
 */
export function readStageData(mod: unknown): StageData | null {
  if (!isRecord(mod)) return null;
  let timeline: Timeline | undefined;
  let tiers: StageData["tiers"] | undefined;
  let bytes: StageData["bytes"] | undefined;
  for (const value of Object.values(mod)) {
    if (isTimeline(value)) timeline = value;
    else if (isBytes(value)) bytes = value;
    else if (isTiers(value)) tiers = value;
  }
  return timeline && tiers && bytes ? { timeline, tiers, bytes } : null;
}

/** A character whose videos are in the library's own folder (`animation/<slug>`). */
export function libraryBundle(slug: CharacterSlug, name: string, data: StageData): StageBundle {
  const tierNames = Object.fromEntries(Object.keys(data.tiers).map((t) => [t, TIER_NAMES[t] ?? t]));
  const media = createStageMedia<string>({
    // The stage drops what is still queued by the last part of the folder, so the id is the slug.
    id: slug,
    name,
    dir: libUrl(`animation/${slug}`),
    tiers: data.tiers,
    bytes: data.bytes,
    tierNames,
    source: SOURCE,
    deferRest: true,
  });
  return {
    slug,
    timeline: data.timeline,
    media,
    bytes: data.bytes,
    skip: hasMaxWait(data.timeline) ? undefined : timeSkip(media),
  };
}

/** The files of a scene, once each: a pose has an entrance, a loop and an exit, a short one file. */
export function sceneFiles(timeline: Timeline, scene: string): string[] {
  if ((PAGE_NAMES as readonly string[]).includes(scene)) {
    const page = timeline.pages[scene as (typeof PAGE_NAMES)[number]];
    return Array.from(new Set([page.in.file, page.loop.file, page.out.file]));
  }
  if ((SHORT_NAMES as readonly string[]).includes(scene)) {
    return [timeline.shorts[scene as (typeof SHORT_NAMES)[number]].file];
  }
  return [];
}

/** The size in bytes of a file in the size chosen for this display (1 when unknown). */
export function fileBytes(bundle: StageBundle, file: string): number {
  const tier = bundle.media.tier();
  return bundle.bytes[tier]?.[file] ?? 1;
}

/**
 * The core files of a character (the welcome and the idle loop) as one loading step, for the
 * loading list of the room and for the warm up of a tab. Reports the bytes received.
 */
export async function loadCoreFiles(
  bundle: StageBundle,
  options: {
    background?: boolean;
    onFraction?: (fraction: number, bytes?: ByteCount) => void;
  } = {},
): Promise<void> {
  const tier = await bundle.media.tierReady();
  const sizes = CORE_FILES.map((f) => fileBytes(bundle, f));
  const all = sizes.reduce((a, b) => a + b, 0);
  const got = CORE_FILES.map(() => 0);
  const gotBytes = CORE_FILES.map(() => 0);
  await Promise.all(
    CORE_FILES.map((file, i) =>
      loadMedia(bundle.media.path(tier, file), {
        type: "video/mp4",
        expectedBytes: bundle.bytes[tier]?.[file],
        background: options.background,
        onFraction: (fraction, bytes) => {
          got[i] = fraction * (sizes[i] ?? 1);
          gotBytes[i] = bytes?.received ?? fraction * (sizes[i] ?? 1);
          options.onFraction?.(got.reduce((a, b) => a + b, 0) / all, {
            received: gotBytes.reduce((a, b) => a + b, 0),
            total: all,
          });
        },
      }),
    ),
  );
}
