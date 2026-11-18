/**
 * `window.__home`: the hooks that frame sheets and tests use to look at the home page without
 * depending on timing. `seek` puts the scroll and the scene at a position in screens, `freeze`
 * holds the scene where it is (time stops, the scroll is not read), `state` says where everything
 * is, `skipIntro` opens the page, `actor` and `sections` look at one thing.
 */
import type { MountState, SectionReport } from "./run";
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
  readonly sections: readonly SectionReport[];
  readonly actors: ReadonlyArray<{ readonly name: string; readonly visible: boolean }>;
  readonly hit: string | null;
}

export interface HomeProbe {
  seek(screens: number): void;
  freeze(on: boolean): void;
  state(): HomeSnapshot;
  skipIntro(): void;
  actor(name: string): { name: string; visible: boolean } | null;
  sections(): ReadonlyArray<{ id: SectionId; start: number; screens: number; mount: MountState }>;
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
