/**
 * `window.__home`: the hooks that frame sheets and tests use to look at the home page without
 * depending on timing. `seek` puts the scroll and the scene at a position in screens, `freeze`
 * holds the scene where it is (time stops, the scroll is not read), `state` says where everything
 * is, `skipIntro` opens the page, `actor` and `sections` look at one thing.
 */
import type { MountState, PlayReport, SectionReport } from "./run";
import type { ScrubReport } from "./scrub";
import type { SnapReport } from "./snap";
import type { SectionId } from "./types";

/** What `state()` returns. Plain data: it goes through `JSON.stringify` in the probes. */
export interface HomeSnapshot {
  /** The position the scene is drawn at, in screens. */
  readonly S: number;
  /** The real scroll position, in screens. */
  readonly raw: number;
  /** The scroll distance of the whole story, in screens. */
  readonly total: number;
  /** Pixels per screen. */
  readonly unit: number;
  readonly open: boolean;
  readonly frozen: boolean;
  readonly size: { readonly w: number; readonly h: number; readonly dpr: number };
  readonly stage: { readonly lost: boolean; readonly failed: boolean; readonly passes: string[] };
  readonly active: SectionId | null;
  /** The section whose play is running (the scroll is held), or null. */
  readonly playing: SectionId | null;
  readonly sections: readonly SectionReport[];
  readonly actors: ReadonlyArray<{ readonly name: string; readonly visible: boolean }>;
  readonly hit: string | null;
  /** The energy of the scroll input in px/s (`FrameInfo.input.wheel`), positive going down. */
  readonly input: number;
}

export interface HomeProbe {
  seek(screens: number): void;
  freeze(on: boolean): void;
  state(): HomeSnapshot;
  skipIntro(): void;
  actor(name: string): { name: string; visible: boolean } | null;
  sections(): ReadonlyArray<{ id: SectionId; start: number; screens: number; mount: MountState }>;
  /** Every section that has plays: `{ id, v, resting, active, fired, length, direction, progress, waiting }`. */
  plays(): PlayReport[];
  /**
   * The snap: `idleMs`, `armed` (the visitor pushed since the last seek), `moving`, `blocked` (why it
   * does not snap now, or null), `zone` (the joint the page is in), `target` (the rest it would run
   * to), and the flick limiter's `chasing`, `real` (the page, in screens) and `seen` (the scene's).
   * `scrub` is the idle snap of the scroll zones (`kernel/scrub.ts`): `idleMs`, `armed`, `moving`,
   * `blocked`, `zone` (the zone the page is in, with `p`), `target`, `heading` and every zone.
   */
  snap(): SnapReport & { chasing: boolean; real: number; seen: number; scrub: ScrubReport };
  /** Build an actor from the lab table, pin it shown and hand it back (see `kernel/lab.ts`). */
  lab(name: string): Promise<unknown>;
  /** Give a lab actor back to the sections. */
  unpin(name: string): void;
}

declare global {
  interface Window {
    __home?: HomeProbe;
  }
}

/** Install the hooks. Returns the way to take them off the window. */
export function installProbes(probe: HomeProbe): () => void {
  window.__home = probe;
  return () => {
    if (window.__home === probe) delete window.__home;
  };
}
