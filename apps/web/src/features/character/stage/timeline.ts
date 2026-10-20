/**
 * What a character's stage needs to know about her videos, written by her build script
 * (`scripts/<name>/build.py`) into `timeline.generated.ts`. All numbers are frames at `fps`.
 */

/** The pages a character opens from her main panel. */
export const PAGE_NAMES = ["about", "skills", "gallery"] as const;
/** The short animations, played from touch points on her picture. */
export const SHORT_NAMES = ["short-1", "short-2", "short-3"] as const;

export type PageName = (typeof PAGE_NAMES)[number];
export type ShortName = (typeof SHORT_NAMES)[number];
export type SceneName = PageName | ShortName;

interface IdleStart {
  file: string;
  frames: number;
  /** Idle loop frames this video can start at. */
  startPhases: readonly number[];
  /** Length of the dissolve into the video, in ms. */
  blendMs: number;
  /** Scale of the video that matches the idle picture at its first frame. */
  align: number;
}

interface BackTiming {
  /** Frame of the video where the dissolve into the idle loop starts. */
  syncFrame: number;
  /** Idle loop frame that matches `syncFrame`, so both move together. */
  syncPhase: number;
  /** Frame where she is back in her idle pose and the panel can come back. */
  uiFrame: number;
  blendMs: number;
  /** Scale of the video that matches the idle picture at `syncFrame`. */
  align: number;
}

interface ShortTiming extends IdleStart {
  back: BackTiming;
}

interface PageTiming {
  in: IdleStart & {
    /** Frame of the entrance where she is in the page's pose and the page content shows. */
    handFrame: number;
    /** Add this to a frame of the entrance to get the matching frame of the page loop. */
    loopOffset: number;
  };
  loop: { file: string; frames: number };
  out: BackTiming & {
    file: string;
    frames: number;
    /** Page loop frame the exit starts at. */
    startPhase: number;
  };
}

export interface Timeline {
  fps: number;
  /** Frames in the idle loop. */
  loopFrames: number;
  /** Frames after a cut that the hand-over skips. */
  extraFrames: number;
  pages: Record<PageName, PageTiming>;
  shorts: Record<ShortName, ShortTiming>;
}

export type VideoKey = "welcome" | "idle" | `${PageName}-${"in" | "loop" | "out"}` | ShortName;

export const VIDEO_KEYS: VideoKey[] = [
  "welcome",
  "idle",
  ...PAGE_NAMES.flatMap((p) => [`${p}-in`, `${p}-loop`, `${p}-out`] as const),
  ...SHORT_NAMES,
];

export const isPage = (scene: SceneName): scene is PageName =>
  (PAGE_NAMES as readonly string[]).includes(scene);
