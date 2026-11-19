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
 *
 * A section with plays (`kernel/plays.ts`) is given a virtual `local` that its machine animates on
 * the clock, in place of the scroll's: the thresholds come from the real scroll, the lead and the
 * tail from the smoothed one. The machine says when the scroll is held (`holdState`); the engine
 * takes and gives the hold. A jump, a programmatic move (`snap`) or a runtime that was not ready
 * puts the machine on the resting value for the position, with no play.
 */
import {
  floorOf,
  isPassed,
  isRunning,
  localOf,
  navOwnerAt,
  wantsMount,
  type Layout,
  type Placed,
} from "./layout";
import { PlayMachine, isZone, zoneProgress } from "./plays";
import type { FrameInfo, SectionCtx, SectionId, SectionRuntime } from "./types";

export type MountState = "idle" | "mounting" | "ready" | "failed";

interface Slot {
  readonly p: Placed;
  mount: MountState;
  runtime: SectionRuntime | null;
  running: boolean;
  /** Replay `local = 1` on the next frame (a runtime that arrived after a jump past it). */
  settleNext: boolean;
  /** The plays of the section, or null (the section follows the scroll). */
  machine: PlayMachine | null;
  /** The runtime's `ready()` threw and was reported once (it is taken as ready after that). */
  readyFailed: boolean;
  /** The scroll is inside the section's range (whether or not its runtime is ready). */
  inRange: boolean;
  /** The range was entered on this frame. */
  entering: boolean;
  /** The machine has been placed and stepped since the section last ran. */
  live: boolean;
}

export interface RunnerDeps {
  readonly layout: Layout;
  readonly actors: { hideAll(): void; apply(): void };
  /** The context a section is mounted with. */
  ctxFor(p: Placed): SectionCtx;
  /** The section that owns the scroll position changed (the top bar's theme follows it). */
  onActive?(p: Placed): void;
  onError?(id: SectionId, error: unknown): void;
  /** Wall-clock milliseconds, for the plays' safety limit (`performance.now` when not given). */
  now?(): number;
}

/** What the plays ask of the scroll hold. One object, written in place every frame. */
export interface HoldState {
  /** Some play is running: the scroll is held. */
  holding: boolean;
  /** The longest wall-clock limit among the running plays, in milliseconds. */
  limitMs: number;
  /** Grows by one each time a play starts: a new play while holding renews the hold. */
  token: number;
  /** The section whose play is running (the first, in scroll order), or null. */
  playing: SectionId | null;
}

export interface SectionReport {
  readonly id: SectionId;
  readonly start: number;
  readonly screens: number;
  readonly local: number;
  readonly running: boolean;
  readonly mount: MountState;
  /** The number `update` gets: the machine's `v` for a section with plays, `local` for the others. */
  readonly v: number;
}

/** What a section's plays are doing now (`window.__home.plays()`). */
export interface PlayReport {
  readonly id: SectionId;
  readonly v: number;
  readonly resting: number;
  readonly active: boolean;
  readonly fired: number;
  readonly length: number;
  readonly direction: -1 | 0 | 1;
  readonly progress: number;
  /** A forward play is due but the runtime is not ready: nothing runs and nothing holds yet. */
  readonly waiting: boolean;
  /** What the table is made of: clock plays only, zones only, or both. */
  readonly kind: "clock" | "zone" | "mixed";
  /** Every zone of the table (empty for a table of clock plays): `{ index, kind: "zone", p, v, resting }`. */
  readonly zones: readonly ZoneReport[];
}

/** One scroll zone of a section (`window.__home.plays()[i].zones`). */
export interface ZoneReport {
  /** The index of the play in the section's table. */
  readonly index: number;
  readonly kind: "zone";
  /** How far through the zone the scene's scroll is, 0 before it and 1 after it. */
  readonly p: number;
  /** The number `update` gets (the section's `v`). */
  readonly v: number;
  /** The scroll is outside the zone: `v` is at a rest. */
  readonly resting: boolean;
}

export class SectionRunner {
  private readonly slots: Slot[];
  private disposed = false;
  private active: SectionId | null = null;
  private lastS = 0;
  private readonly hold: HoldState = { holding: false, limitMs: 0, token: 0, playing: null };

  constructor(private readonly deps: RunnerDeps) {
    this.slots = deps.layout.placed.map((p) => {
      const slot: Slot = {
        p,
        mount: "idle",
        runtime: null,
        running: false,
        settleNext: false,
        machine: null,
        readyFailed: false,
        inRange: false,
        entering: false,
        live: false,
      };
      if (p.def.plays) {
        slot.machine = new PlayMachine(p.id, p.def.plays, {
          screens: p.def.screens,
          floor: floorOf(p),
          restOutside: p.def.restOutside,
          ready: () => this.isReady(slot),
        });
      }
      return slot;
    });
  }

  /** The ready gate of a section: its runtime's `ready()`, true when it has none or it throws. */
  private isReady(slot: Slot): boolean {
    const runtime = slot.runtime;
    if (!runtime?.ready) return true;
    try {
      return runtime.ready();
    } catch (error) {
      if (!slot.readyFailed) {
        slot.readyFailed = true;
        this.deps.onError?.(slot.p.id, error);
      }
      return true;
    }
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

  /**
   * Run one frame. `jumped` is true when the scroll position leapt (see `SceneScroll`). `snap` is
   * true while the page is being moved by a script (a smooth `scroll.to` on its way, a control that
   * took the focus): the plays rest on the position instead of firing.
   */
  step(frame: FrameInfo, jumped: boolean, snap = false): void {
    if (this.disposed) return;
    const S = frame.S;
    this.lastS = S;
    const now = this.deps.now ? this.deps.now() : performance.now();

    for (const slot of this.slots) {
      const inRange = isRunning(slot.p, S);
      slot.entering = inRange && !slot.inRange;
      slot.inRange = inRange;
    }

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

    // A section that is not running (or not built, or failed) lets go of its play.
    for (const slot of this.slots) {
      if (slot.machine && slot.live && !(slot.mount === "ready" && slot.inRange)) {
        slot.machine.leave();
        slot.live = false;
      }
    }

    // The passed sections, in order, once. Their effect on actors is wiped by the next step.
    for (const slot of this.slots) {
      if (slot.mount !== "ready" || !isPassed(slot.p, S)) continue;
      if (jumped || slot.settleNext) {
        slot.settleNext = false;
        // A section with plays ends where its last play ends, and its tail has been ridden out: a
        // jump past it gives the picture of its last frame, as scrolling there slowly would have (a
        // layer that leaves in the tail is gone, not stuck over the sections after it).
        const base = slot.machine ? slot.machine.end : 1;
        const tail = slot.p.def.restOutside ? 0 : slot.p.def.tail / slot.p.def.screens;
        const end = base + tail;
        this.guard(slot, () => slot.runtime?.update(end, frame));
      }
    }

    this.deps.actors.hideAll();
    for (const slot of this.slots) {
      if (slot.mount !== "ready" || !isRunning(slot.p, S)) continue;
      let local = localOf(slot.p, S);
      const machine = slot.machine;
      if (machine) {
        const sRaw = (frame.raw - slot.p.start) / slot.p.def.screens;
        const direct = jumped || snap;
        if (!slot.live) {
          slot.live = true;
          // A scroll that ran into the range fires its crossing; anything else lands on its place.
          if (slot.entering && !direct) machine.enter(local);
          else machine.jump(sRaw, local);
        } else if (direct) {
          machine.jump(sRaw, local);
        }
        if (!direct) machine.step(sRaw, local, frame.dt, now);
        local = machine.value;
      }
      this.guard(slot, () => slot.runtime?.update(local, frame));
    }
    this.deps.actors.apply();
    this.collectHold();
  }

  /** Some section has a forward play due that its runtime's ready gate holds back. */
  waiting(): boolean {
    for (const slot of this.slots) {
      if (slot.live && slot.machine?.waiting) return true;
    }
    return false;
  }

  /** What the plays ask of the scroll hold, as of the last frame. The object is reused. */
  holdState(): Readonly<HoldState> {
    return this.hold;
  }

  /** What every section's plays are doing now (the probe). */
  plays(): PlayReport[] {
    const out: PlayReport[] = [];
    for (const slot of this.slots) {
      const m = slot.machine;
      if (!m) continue;
      const v = slot.live ? m.value : localOf(slot.p, this.lastS);
      const s = localOf(slot.p, this.lastS);
      const zones: ZoneReport[] = [];
      m.table.forEach((play, index) => {
        if (!isZone(play)) return;
        const p = zoneProgress(play, s);
        zones.push({ index, kind: "zone", p, v, resting: p <= 0 || p >= 1 });
      });
      const kind = zones.length === 0 ? "clock" : zones.length === m.length ? "zone" : "mixed";
      out.push({
        id: slot.p.id,
        v,
        kind,
        zones,
        resting: m.resting,
        active: m.active,
        fired: m.fired,
        length: m.length,
        direction: m.direction,
        progress: m.progress,
        waiting: slot.live && m.waiting,
      });
    }
    return out;
  }

  private collectHold(): void {
    const h = this.hold;
    h.holding = false;
    h.limitMs = 0;
    h.playing = null;
    let token = 0;
    for (const slot of this.slots) {
      const m = slot.machine;
      if (!m) continue;
      token += m.started;
      if (slot.live && m.active) {
        h.holding = true;
        h.limitMs = Math.max(h.limitMs, m.limitMs);
        h.playing ??= slot.p.id;
      }
    }
    h.token = token;
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
      v: slot.machine && slot.live ? slot.machine.value : localOf(slot.p, S),
    }));
  }

  /** The runtime of a mounted section, for the probe and the tests. */
  runtimeOf(id: SectionId): SectionRuntime | null {
    return this.slots.find((s) => s.p.id === id)?.runtime ?? null;
  }

  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots) {
      slot.machine?.leave();
      slot.live = false;
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
