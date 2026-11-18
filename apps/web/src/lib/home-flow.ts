import { create } from "zustand";

import { audio } from "@/lib/audio";
import { INTRO_KEY } from "@/lib/home-arrival";
import type { PreloadProgress } from "@/lib/preload";

/**
 * Where the home page's own opening is, for everyone who needs to know (the loader, the page, the
 * bar). The opening is the drone loading screen, the tap gate and the intro that carries the logo
 * in. It runs on a document load of `/` only (`lib/home-arrival.ts`). Every other way of arriving
 * at `/` opens the page at rest at once.
 *
 *   arrival  "document"  this document load runs the opening (a visit from outside, or a reload)
 *            "site"      it does not: another route was the landing page, so `/` (reached later by
 *                        the logo curtain) opens at rest with nothing to wait for
 *            "off"       `aspirants:intro` is `off` (tests, probes): everything shown, no holds
 *
 *   phase    cover   the plain cover painted by the boot script is up; the loading screen mounts under it
 *            boot    the cover is gone and the real bar runs (the cover goes only after the first
 *                    frame of the loading screen is drawn, never on a timer)
 *            tap     everything waited for has arrived: "Touch anywhere to continue"
 *            intro   after the press: the intro plays (the logo is carried in); scroll held
 *            open    the page is the visitor's. `entered` is set here, not at the press.
 *
 * Phases only move forward. `isOpen` is `phase === "open"` (`selectIsOpen`). A page that mounts
 * with `arrival` "site" or "off" finds the phase already `open`.
 *
 * Hydration: the store starts neutral (`site`, `open`), the same on the server and in the first
 * client render, and `settleHomeFlow()` moves it to the real values as soon as this module runs in
 * the browser (before any component effect). So `useHomeFlow.getState()` is right from the first
 * effect, but the first RENDER of a component still sees the neutral state. Read the live state in
 * effects, and never branch markup on the phase while rendering.
 */
/** @public */
export type HomeArrival = "document" | "site" | "off";

export const HOME_PHASES = ["cover", "boot", "tap", "intro", "open"] as const;
export type HomePhase = (typeof HOME_PHASES)[number];

/** Position of a phase in the order. */
export function phaseIndex(phase: HomePhase): number {
  return HOME_PHASES.indexOf(phase);
}

/** True when `phase` is `target` or later. */
export function phaseAtLeast(phase: HomePhase, target: HomePhase): boolean {
  return phaseIndex(phase) >= phaseIndex(target);
}

/** @public */
export interface HomeNotes {
  /** 15 seconds have passed and the files are still coming. */
  slow: boolean;
  /** The browser says there is no connection. */
  offline: boolean;
  /** A download stalled and is being tried again. */
  retrying: boolean;
}

interface Seed {
  arrival: HomeArrival;
  phase: HomePhase;
}

/** The first state, from what the boot script and the session say. Pure. */
export function seedFor(input: { arrivalAttr: boolean; introOff: boolean }): Seed {
  if (input.arrivalAttr) return { arrival: "document", phase: "cover" };
  if (input.introOff) return { arrival: "off", phase: "open" };
  return { arrival: "site", phase: "open" };
}

interface HomeFlowState extends Seed {
  /** The real progress of the home's list (about ten times a second). Null before it starts. */
  progress: PreloadProgress | null;
  notes: HomeNotes;
  /** Used by `settleHomeFlow`. */
  seed: (seed: Seed) => void;
  setProgress: (progress: PreloadProgress) => void;
  setNotes: (notes: HomeNotes) => void;
  /** The loading screen has drawn (`boot`), or everything has arrived (`tap`). Forward only. */
  advance: (to: "boot" | "tap") => void;
  /** The visitor pressed: `tap` to `intro`. Call `tapToContinue()` instead, it unlocks the sound. */
  tap: () => void;
  /** The intro has ended: `intro` to `open`. Whoever plays the intro calls this, once, at its end. */
  finishIntro: () => void;
  /** Something failed (the loading screen threw): open the page at once, whatever the phase. */
  abort: () => void;
}

export const useHomeFlow = create<HomeFlowState>()((set) => ({
  arrival: "site",
  phase: "open",
  progress: null,
  notes: { slow: false, offline: false, retrying: false },
  seed: (seed) => {
    set(seed);
  },
  setProgress: (progress) => {
    set({ progress });
  },
  setNotes: (notes) => {
    set((s) =>
      s.notes.slow === notes.slow &&
      s.notes.offline === notes.offline &&
      s.notes.retrying === notes.retrying
        ? s
        : { notes },
    );
  },
  advance: (to) => {
    set((s) => (phaseIndex(to) > phaseIndex(s.phase) ? { phase: to } : s));
  },
  tap: () => {
    set((s) => (s.phase === "tap" ? { phase: "intro" } : s));
  },
  finishIntro: () => {
    set((s) => (s.phase === "intro" ? { phase: "open" } : s));
  },
  abort: () => {
    set((s) => (s.phase === "open" ? s : { phase: "open" }));
  },
}));

/** The page is the visitor's: no loading screen, no intro, no hold. */
export const selectIsOpen = (s: { phase: HomePhase }): boolean => s.phase === "open";

/** The opening of this document is still running (the loading screen or the intro is up). */
export const selectHomeActive = (s: Seed): boolean =>
  s.arrival === "document" && s.phase !== "open";

/**
 * `isOpen` as a hook.
 * @public
 */
export function useHomeIsOpen(): boolean {
  return useHomeFlow(selectIsOpen);
}

let settled = false;

/**
 * Reads the boot script's `html[data-arrival]` and `sessionStorage["aspirants:intro"]` once per
 * document and seeds the store. It runs when this module is first evaluated in the browser, and
 * again from `LoaderGate` (a second call does nothing). The attribute is taken off after it has
 * been read, so a remount or a hot reload never plays the opening twice.
 */
export function settleHomeFlow(): void {
  if (settled || typeof document === "undefined") return;
  settled = true;
  const root = document.documentElement;
  let introOff = false;
  try {
    introOff = window.sessionStorage.getItem(INTRO_KEY) === "off";
  } catch {
    /* storage unavailable: the intro is on */
  }
  const arrivalAttr = root.dataset.arrival === "home";
  delete root.dataset.arrival;
  useHomeFlow.getState().seed(seedFor({ arrivalAttr, introOff }));
}

settleHomeFlow();

/** Resolves when the phase is `target` or later. */
export function whenHomePhase(target: HomePhase): Promise<void> {
  return new Promise((resolve) => {
    const reached = () => phaseAtLeast(useHomeFlow.getState().phase, target);
    if (reached()) {
      resolve();
      return;
    }
    const stop = useHomeFlow.subscribe(() => {
      if (!reached()) return;
      stop();
      resolve();
    });
  });
}

/**
 * The press that ends the tap gate. Runs inside the pointer or key event, so the sound can be
 * unlocked there (a browser only allows it from a gesture). Does nothing outside the tap phase.
 * Every control and listener that means "continue" calls this, never `tap()` alone.
 */
export function tapToContinue(): void {
  if (useHomeFlow.getState().phase !== "tap") return;
  audio.unlock();
  useHomeFlow.getState().tap();
}

/**
 * Listens for the press while the tap gate is up: any click or tap (counted only when the press
 * began after the gate appeared, so a press that was already down when the files arrived does not
 * answer it), Enter and Space. Returns the way to stop listening.
 */
export function listenForTap(): () => void {
  let armed = false;
  const down = () => {
    armed = true;
  };
  const click = () => {
    if (armed) tapToContinue();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    tapToContinue();
  };
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("click", click, true);
  window.addEventListener("keydown", key, true);
  return () => {
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("click", click, true);
    window.removeEventListener("keydown", key, true);
  };
}

export interface HomeFlowDeps {
  /** Loads everything the home waits for, reporting the real progress (`runPreload`). */
  load: (report: (p: PreloadProgress) => void) => Promise<void>;
  /** Resolves when every component with a slow first paint has drawn (`whenPageReady`). */
  ready: () => Promise<void>;
  /** The first frame of the loading screen is drawn: the plain cover can go. */
  dropCover: () => void;
  /** Every file is in: the slow-connection note has nothing more to say. */
  loaded: () => void;
  /** Listens for the press at the tap gate. Default `listenForTap`. */
  listen?: () => () => void;
}

/**
 * Runs the home opening from the cover to `open`, and resolves when the page is open (also when
 * `abort()` opens it early). No timer: each step waits for the real thing.
 *
 *   cover   wait for the loading screen's first frame (`boot`), then `dropCover`
 *   boot    wait for the whole list, however long that takes
 *   tap     wait for the components that draw slowly, then show the gate and wait for the press
 *   intro   whoever plays the intro calls `finishIntro()`
 *   open    resolve
 */
export async function runHomeFlow(deps: HomeFlowDeps): Promise<void> {
  const flow = useHomeFlow;
  const open = whenHomePhase("open");
  const guard = <T>(work: Promise<T>) => Promise.race([work, open]);
  const isOpen = () => selectIsOpen(flow.getState());

  const loading = deps.load((p) => {
    flow.getState().setProgress(p);
  });
  void loading.then(deps.loaded);
  const drawn = guard(whenHomePhase("boot")).then(() => {
    if (!isOpen()) deps.dropCover();
  });
  await guard(Promise.all([drawn, loading]));

  if (!isOpen()) await guard(deps.ready());
  if (!isOpen()) {
    flow.getState().advance("tap");
    const stop = (deps.listen ?? listenForTap)();
    await guard(whenHomePhase("intro"));
    stop();
  }
  await open;
}

// Shown progress ----------------------------------------------------------------------------------

/** How fast the shown number closes on the real one (per second). */
const CATCH_UP_RATE = 6;

/**
 * The shown fraction for the next frame. It closes on the real fraction with an easing, never
 * passes it and never goes back, so the number lags the truth and never leads it.
 */
export function stepShown(shown: number, real: number, dtSeconds: number): number {
  const target = Math.min(1, Math.max(0, real));
  if (target <= shown) return shown;
  const k = 1 - Math.exp(-CATCH_UP_RATE * Math.max(0, dtSeconds));
  return Math.min(target, shown + (target - shown) * k);
}

/**
 * The percent that is written on the screen. Whole numbers, rounded down, never above the real
 * percent, and 99 at the most until the list is done: 100 is only ever shown when it is true.
 */
export function shownPercent(shown: number, real: number, done: boolean): number {
  if (done) return 100;
  const cap = Math.min(99, Math.floor(Math.max(0, real) * 100));
  return Math.max(0, Math.min(cap, Math.floor(Math.max(0, shown) * 100)));
}

/**
 * One of the labels of the downloads that are running now, changing with `tick` (the caller counts
 * a tick every two or three seconds). The labels are real: each one names a file that is coming.
 */
export function pickPending(pending: readonly string[], fallback: string, tick: number): string {
  if (pending.length === 0) return fallback;
  const n = Math.max(0, Math.floor(tick));
  return pending[n % pending.length] ?? fallback;
}

function megabytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

/**
 * The bytes in words: "3.2 MB of 9.8 MB". While some download has not said its size yet the
 * total is not final, so only what has arrived is said.
 */
export function bytesWords(bytes: PreloadProgress["bytes"]): string {
  if (!bytes || bytes.received <= 0) return "";
  if (bytes.partial || bytes.total <= 0) return `${megabytes(bytes.received)} received`;
  return `${megabytes(bytes.received)} of ${megabytes(bytes.total)}`;
}
