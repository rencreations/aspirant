/**
 * Runs the sections each frame. The order inside one frame is fixed, and it is what keeps the scroll
 * stateless (a jump gives the same picture as scrolling there slowly):
 *
 *   1. mount what is near (a section mounts when the scroll is within `MOUNT_AHEAD` screens of it);
 *   2. `enter` and `leave` for the sections whose range was crossed;
 *   3. after a jump, the sections that were passed run once at `local = 1`, in order, so whatever
 *      they leave behind (DOM, audio, their own state) is as if the visitor had scrolled through;
 *   4. every actor is hidden;
 *   5. the sections in range run in order, each at its own `local`, and the last writer wins;
 *   6. the actors' visibility is copied to the things the stage draws.
 *
 * A runtime that is still mounting is skipped. If it is passed when it arrives, it replays
 * `local = 1` once. A runtime that throws is logged once and left out.
 */
import {
  isPassed,
  isRunning,
  localOf,
  navOwnerAt,
  wantsMount,
  type Layout,
  type Placed,
} from "./layout";
import type { FrameInfo, SectionCtx, SectionId, SectionRuntime } from "./types";

export type MountState = "idle" | "mounting" | "ready" | "failed";

interface Slot {
  readonly p: Placed;
  mount: MountState;
  runtime: SectionRuntime | null;
  running: boolean;
  /** Replay `local = 1` on the next frame (a runtime that arrived after a jump past it). */
  settleNext: boolean;
}

export interface RunnerDeps {
  readonly layout: Layout;
  readonly actors: { hideAll(): void; apply(): void };
  /** The context a section is mounted with. */
  ctxFor(p: Placed): SectionCtx;
  /** The section that owns the scroll position changed (the top bar's theme follows it). */
  onActive?(p: Placed): void;
  onError?(id: SectionId, error: unknown): void;
}

export interface SectionReport {
  readonly id: SectionId;
  readonly start: number;
  readonly screens: number;
  readonly local: number;
  readonly running: boolean;
  readonly mount: MountState;
}

export class SectionRunner {
  private readonly slots: Slot[];
  private disposed = false;
  private active: SectionId | null = null;
  private lastS = 0;

  constructor(private readonly deps: RunnerDeps) {
    this.slots = deps.layout.placed.map((p) => ({
      p,
      mount: "idle",
      runtime: null,
      running: false,
      settleNext: false,
    }));
  }

  /**
   * Start mounting what is near `S` without running anything. The page does this while its opening
   * is still up, so the first sections are built by the time it opens.
   */
  prime(S: number): void {
    if (this.disposed) return;
    this.lastS = S;
    for (const slot of this.slots) {
      if (slot.mount === "idle" && wantsMount(slot.p, S)) this.mount(slot);
    }
  }

  /** How many sections are still being built. */
  mounting(): number {
    return this.slots.filter((slot) => slot.mount === "mounting").length;
  }

  /** Run one frame. `jumped` is true when the scroll position leapt (see `SceneScroll`). */
  step(frame: FrameInfo, jumped: boolean): void {
    if (this.disposed) return;
    const S = frame.S;
    this.lastS = S;

    for (const slot of this.slots) {
      if (slot.mount === "idle" && wantsMount(slot.p, S)) this.mount(slot);
    }

    // The top bar's owner may take the bar a little before its start (`nav.early`).
    const owner = navOwnerAt(this.deps.layout, S);
    if (owner.id !== this.active) {
      this.active = owner.id;
      this.deps.onActive?.(owner);
    }

    // Leave first, then enter, so a jump does not run two ranges' audio at once.
    for (const slot of this.slots) {
      if (slot.mount === "ready" && slot.running && !isRunning(slot.p, S)) {
        slot.running = false;
        this.guard(slot, () => slot.runtime?.leave?.());
      }
    }
    for (const slot of this.slots) {
      if (slot.mount === "ready" && !slot.running && isRunning(slot.p, S)) {
        slot.running = true;
        this.guard(slot, () => slot.runtime?.enter?.());
      }
    }

    // The passed sections, in order, once. Their effect on actors is wiped by the next step.
    for (const slot of this.slots) {
      if (slot.mount !== "ready" || !isPassed(slot.p, S)) continue;
      if (jumped || slot.settleNext) {
        slot.settleNext = false;
        this.guard(slot, () => slot.runtime?.update(1, frame));
      }
    }

    this.deps.actors.hideAll();
    for (const slot of this.slots) {
      if (slot.mount !== "ready" || !isRunning(slot.p, S)) continue;
      this.guard(slot, () => slot.runtime?.update(localOf(slot.p, S), frame));
    }
    this.deps.actors.apply();
  }

  /** What each section is doing now (the probe). */
  report(S: number = this.lastS): SectionReport[] {
    return this.slots.map((slot) => ({
      id: slot.p.id,
      start: slot.p.start,
      screens: slot.p.def.screens,
      local: localOf(slot.p, S),
      running: slot.running,
      mount: slot.mount,
    }));
  }

  /** The runtime of a mounted section, for the probe and the tests. */
  runtimeOf(id: SectionId): SectionRuntime | null {
    return this.slots.find((s) => s.p.id === id)?.runtime ?? null;
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots) {
      const runtime = slot.runtime;
      slot.runtime = null;
      if (runtime) {
        if (slot.running) this.guard(slot, () => runtime.leave?.(), false);
        try {
          runtime.dispose();
        } catch (error) {
          this.deps.onError?.(slot.p.id, error);
        }
      }
      slot.running = false;
    }
  }

  private mount(slot: Slot): void {
    slot.mount = "mounting";
    void Promise.resolve()
      .then(() => slot.p.def.mount(this.deps.ctxFor(slot.p)))
      .then(
        (runtime) => {
          if (this.disposed) {
            runtime.dispose();
            return;
          }
          slot.runtime = runtime;
          slot.mount = "ready";
          // Passed while it was arriving: replay the end once.
          if (isPassed(slot.p, this.lastS)) slot.settleNext = true;
        },
        (error: unknown) => {
          slot.mount = "failed";
          this.deps.onError?.(slot.p.id, error);
        },
      );
  }

  private guard(slot: Slot, run: () => void, drop = true): void {
    try {
      run();
    } catch (error) {
      if (drop) {
        const runtime = slot.runtime;
        slot.mount = "failed";
        slot.running = false;
        slot.runtime = null;
        try {
          runtime?.dispose();
        } catch {
          /* the first error is the one that is reported */
        }
      }
      this.deps.onError?.(slot.p.id, error);
    }
  }
}
