/**
 * The one `requestAnimationFrame` loop of the home. Nothing else on the page runs a loop of its
 * own: the scroll, the sections, the actors and the stage are callbacks here, in a fixed order.
 */

/** The longest step a frame may take, in seconds. A tab that comes back does not leap. */
export const DT_MAX = 0.05;

/** The order the engine registers its callbacks in. Smaller runs first. */
export const ORDER = {
  scroll: 0,
  pointer: 10,
  sections: 20,
  actors: 30,
  background: 40,
  draw: 50,
} as const;

interface ClockFrame {
  /** Seconds since the first frame. */
  readonly time: number;
  readonly dt: number;
  readonly frame: number;
}

type Callback = (frame: ClockFrame) => void;

/** `dt` for a frame that came `elapsedMs` after the last one, clamped. */
export function clampDt(elapsedMs: number): number {
  const s = elapsedMs / 1000;
  if (!(s > 0)) return 0;
  return Math.min(DT_MAX, s);
}

export class Clock {
  private readonly callbacks: Array<{ order: number; seq: number; run: Callback }> = [];
  private seq = 0;
  private raf = 0;
  private last = -1;
  private time = 0;
  private frames = 0;
  private running = false;

  /** Add a per-frame callback. Returns the way to take it out. */
  add(run: Callback, order = 100): () => void {
    const entry = { order, seq: this.seq++, run };
    this.callbacks.push(entry);
    this.callbacks.sort((a, b) => a.order - b.order || a.seq - b.seq);
    return () => {
      const at = this.callbacks.indexOf(entry);
      if (at >= 0) this.callbacks.splice(at, 1);
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Run one frame at the time `now` (milliseconds). The loop calls it; tests call it too. */
  tick(now: number): void {
    const dt = this.last < 0 ? 0 : clampDt(now - this.last);
    this.last = now;
    this.time += dt;
    const frame: ClockFrame = { time: this.time, dt, frame: this.frames++ };
    // A copy: a callback may add or remove callbacks.
    for (const entry of this.callbacks.slice()) entry.run(frame);
  }

  private readonly loop = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    // A hidden tab draws nothing and does not count the gap as time.
    if (typeof document !== "undefined" && document.hidden) {
      this.last = -1;
      return;
    }
    this.tick(now);
  };
}
