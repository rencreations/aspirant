/** How long the room waits, with nothing done, before it hides its controls in full screen. */
export const IDLE_MS = 2500;

interface Timers {
  set: (fn: () => void, ms: number) => number;
  clear: (id: number) => void;
}

const WINDOW_TIMERS: Timers = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (id) => {
    window.clearTimeout(id);
  },
};

/**
 * Says when the controls of the room may hide: after `ms` with nothing done, while it is on (in
 * full screen). Anything the visitor does (`wake`) shows them again and starts the wait anew. A
 * hold (the pointer over the bar, the contents open) keeps them shown for as long as it lasts; the
 * wait starts again when the last hold ends. Off, the controls are always shown.
 */
export class IdleWatch {
  private on = false;
  private idle = false;
  private timer = 0;
  private readonly holds = new Set<string>();
  private readonly tell: (idle: boolean) => void;
  private readonly timers: Timers;
  private readonly ms: number;

  constructor(tell: (idle: boolean) => void, timers: Timers = WINDOW_TIMERS, ms = IDLE_MS) {
    this.tell = tell;
    this.timers = timers;
    this.ms = ms;
  }

  /** The controls are hidden now. */
  get hidden(): boolean {
    return this.idle;
  }

  /** Start watching (full screen began): the wait starts now. */
  start(): void {
    this.on = true;
    this.wake();
  }

  /** Stop watching (full screen ended): the controls show and stay. */
  stop(): void {
    this.on = false;
    this.clear();
    this.set(false);
  }

  /** The visitor did something: show the controls and wait again. */
  wake(): void {
    if (!this.on) return;
    this.set(false);
    this.arm();
  }

  /** Keep the controls shown while `held` (by `reason`); the wait starts when the last hold ends. */
  hold(reason: string, held: boolean): void {
    if (held === this.holds.has(reason)) return;
    if (held) this.holds.add(reason);
    else this.holds.delete(reason);
    if (!this.on) return;
    if (held) {
      this.clear();
      this.set(false);
    } else {
      this.arm();
    }
  }

  private arm(): void {
    this.clear();
    if (!this.on || this.holds.size > 0) return;
    this.timer = this.timers.set(() => {
      this.timer = 0;
      this.set(true);
    }, this.ms);
  }

  private clear(): void {
    if (this.timer) this.timers.clear(this.timer);
    this.timer = 0;
  }

  private set(idle: boolean): void {
    if (idle === this.idle) return;
    this.idle = idle;
    this.tell(idle);
  }
}
