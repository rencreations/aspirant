import {
  WHEEL,
  easeInOut,
  filmAt,
  jumpPlan,
  rebase,
  releaseSlot,
  settleSlot,
  stepFree,
  stepSnap,
  wheelImpulse,
  type Override,
} from "./film-math";

interface MotionHooks {
  /** Draw the strip at `pos` (only transforms are written). */
  frame(pos: number, override: Override | null): void;
  /** The film that covers most of the screen changed. `fast`: the strip is flying past it. */
  active(film: number, fast: boolean): void;
  /** The strip has come to rest on `film`, after moving in `dir`. */
  settle(film: number, dir: 1 | -1 | 0): void;
}

/** A step from a key, a button or the end of a film, and a jump from the contents. */
const STEP_MS = 950;
/** A press that moves less than this is a press, not a drag. */
const DRAG_PX = 6;

interface Drag {
  id: number;
  y0: number;
  pos0: number;
  dragging: boolean;
  samples: Array<{ t: number; y: number }>;
}

/**
 * The endless strip of the Films room: its own scroll, like the reference, not the page's. The
 * wheel feeds a speed that slows down by friction while the place eases after it; when the wheel
 * has been still for a moment the strip snaps to the nearest film in the direction it went. A drag
 * follows the finger and a flick goes on to the next film. Keys and buttons step one film, and a
 * jump from the contents arrives in one slide. One loop runs while something moves, and stops.
 */
export class FilmMotion {
  private pos: number;
  private rest: number;
  private target: number;
  private vel = 0;
  private snapTo = 0;
  private mode: "rest" | "free" | "snap" | "drag" | "tween" = "rest";
  private tween: { from: number; to: number; start: number; ms: number } | null = null;
  private override: Override | null = null;
  private drag: Drag | null = null;
  private lastInput = 0;
  private raf = 0;
  private last = 0;
  private shown = -1;
  private readonly count: number;
  private readonly hooks: MotionHooks;
  private readonly screen: () => number;

  constructor(count: number, start: number, hooks: MotionHooks, screen: () => number) {
    this.count = count;
    this.hooks = hooks;
    this.screen = screen;
    this.pos = start;
    this.rest = start;
    this.target = start;
  }

  /** Draw the first frame and say which film is on screen. */
  begin(): void {
    this.draw(false);
    this.hooks.settle(filmAt(this.rest, this.count), 0);
  }

  /** The film the strip rests on (or is going to). */
  restingFilm(): number {
    if (this.override) return this.override.film;
    const slot =
      this.mode === "tween" && this.tween
        ? this.tween.to
        : this.mode === "snap"
          ? this.snapTo
          : this.rest;
    return filmAt(slot, this.count);
  }

  /** Something is moving the strip by itself (a jump). Input waits. */
  busy(): boolean {
    return this.override !== null;
  }

  wheel(deltaY: number, deltaMode: number): void {
    if (this.busy() || this.mode === "drag") return;
    if (this.mode !== "free") {
      this.mode = "free";
      this.target = this.pos;
      this.vel = 0;
      this.tween = null;
    }
    const impulse = wheelImpulse(deltaY, deltaMode, this.screen());
    // A turn of the wheel the other way stops the run at once.
    if (impulse * this.vel < 0) this.vel *= 0.3;
    this.vel = Math.max(-WHEEL.maxVel, Math.min(WHEEL.maxVel, this.vel + impulse));
    this.lastInput = performance.now();
    this.kick();
  }

  /** A press on the strip. */
  down(id: number, y: number): void {
    if (this.busy()) return;
    this.drag = {
      id,
      y0: y,
      pos0: this.pos,
      dragging: false,
      samples: [{ t: performance.now(), y }],
    };
  }

  /** The pointer moves. Returns true once this press has become a drag. */
  move(id: number, y: number): boolean {
    const d = this.drag;
    if (d?.id !== id) return false;
    const now = performance.now();
    d.samples.push({ t: now, y });
    while (d.samples.length > 2 && now - (d.samples[0]?.t ?? now) > 120) d.samples.shift();
    if (!d.dragging) {
      if (Math.abs(y - d.y0) < DRAG_PX) return false;
      d.dragging = true;
      d.y0 = y;
      d.pos0 = this.pos;
      this.mode = "drag";
      this.tween = null;
      this.vel = 0;
    }
    this.pos = d.pos0 + (d.y0 - y) / this.screen();
    this.kick();
    return true;
  }

  /** The press ends. Returns true when it was a tap (no drag). */
  up(id: number, y: number): boolean {
    const d = this.drag;
    if (d?.id !== id) return false;
    this.drag = null;
    if (!d.dragging) return true;
    const first = d.samples[0];
    const now = performance.now();
    const dt = first ? Math.max(16, now - first.t) : 16;
    const velocity = first ? (first.y - y) / this.screen() / (dt / 1000) : 0;
    this.mode = "snap";
    this.snapTo = releaseSlot(this.pos, this.rest, velocity);
    this.kick();
    return false;
  }

  /** The press was taken away (the browser took over the gesture). */
  cancel(id: number): void {
    if (this.drag?.id !== id) return;
    const was = this.drag.dragging;
    this.drag = null;
    if (!was) return;
    this.mode = "snap";
    this.snapTo = settleSlot(this.pos, this.rest, 0.5);
    this.kick();
  }

  /** One film on (`1`) or back (`-1`). Pressed again while moving, it goes one further. */
  step(dir: 1 | -1): void {
    if (this.busy() || this.mode === "drag") return;
    const base =
      this.mode === "tween" && this.tween
        ? this.tween.to
        : this.mode === "snap"
          ? this.snapTo
          : this.mode === "free"
            ? settleSlot(this.target, this.rest)
            : this.rest;
    this.tweenTo(base + dir);
  }

  /** Go straight to `film`: one slide in the shorter direction, with that film arriving. */
  jumpTo(film: number): void {
    if (this.busy() || this.mode === "drag") return;
    if (this.mode !== "rest") {
      // Settle where it is going first, then jump from there.
      this.land(Math.round(this.pos), false);
    }
    const plan = jumpPlan(this.rest, film, this.count);
    if (!plan) return;
    this.override = plan.override;
    this.tweenTo(plan.slot);
  }

  /** The screen changed size: draw again at the same place. */
  resize(): void {
    this.draw(false);
  }

  /**
   * For frame sheets only (`window.__filmsRoom`): draw the strip at `pos` without moving it, or
   * where it really is when `pos` is null. Use it while the strip is at rest.
   */
  peek(pos: number | null): void {
    if (pos === null) {
      this.draw(false);
      return;
    }
    this.hooks.frame(pos, this.override);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // -------------------------------------------------------------------------------------------

  private tweenTo(slot: number): void {
    this.mode = "tween";
    this.vel = 0;
    this.tween = { from: this.pos, to: slot, start: performance.now(), ms: STEP_MS };
    this.kick();
  }

  private kick(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    this.raf = 0;
    const frames = Math.min(4, Math.max(0, (now - this.last) / (1000 / 60)));
    this.last = now;
    const before = this.pos;
    if (this.mode === "free") {
      const m = stepFree({ pos: this.pos, target: this.target, vel: this.vel }, frames);
      this.pos = m.pos;
      this.target = m.target;
      this.vel = m.vel;
      if (Math.abs(this.vel) < 0.002 && now - this.lastInput > WHEEL.quietMs) {
        // Judge by where the scroll is heading (the place still eases behind it).
        this.mode = "snap";
        this.snapTo = settleSlot(this.target, this.rest);
      }
    } else if (this.mode === "snap") {
      this.pos = stepSnap(this.pos, this.snapTo, frames);
      if (Math.abs(this.snapTo - this.pos) < 0.0015) {
        this.land(this.snapTo, true);
        return;
      }
    } else if (this.mode === "tween" && this.tween) {
      const t = (now - this.tween.start) / this.tween.ms;
      this.pos = this.tween.from + (this.tween.to - this.tween.from) * easeInOut(t);
      if (t >= 1) {
        this.land(this.tween.to, true);
        return;
      }
    }
    this.draw(Math.abs(this.pos - before) > 0.045);
    if (this.mode !== "rest") this.raf = requestAnimationFrame(this.loop);
  };

  /** Come to rest on `slot`. */
  private land(slot: number, tell: boolean): void {
    const dir: 1 | -1 | 0 = slot > this.rest ? 1 : slot < this.rest ? -1 : 0;
    let at = slot;
    if (this.override?.slot === slot) {
      at = rebase(slot, this.override.film, this.count);
    }
    this.override = null;
    this.tween = null;
    this.vel = 0;
    this.mode = "rest";
    this.pos = at;
    this.rest = at;
    this.target = at;
    this.draw(false);
    if (tell) this.hooks.settle(filmAt(at, this.count), dir);
  }

  private draw(fast: boolean): void {
    this.hooks.frame(this.pos, this.override);
    const film = filmAt(Math.round(this.pos), this.count, this.override);
    if (film !== this.shown) {
      this.shown = film;
      this.hooks.active(film, fast);
    }
  }
}
