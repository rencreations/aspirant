/**
 * The stepper of the Splash art stage, outside React. One place `pos` (in pictures, unbounded) is
 * eased after a `target` that input moves: a wheel turn, a key, a finger, a press on the list. A
 * frame loop runs only while the place is not at the target, and stops. Nothing here knows about the
 * DOM: it tells its hooks to draw and when the picture in front changes.
 */
import {
  ENTRANCE_FROM,
  LAMBDA,
  LAND_AT,
  LAMBDA_DRAG,
  TAP_PX,
  WheelGate,
  activeOf,
  limitLead,
  rebase,
  slotOf,
  stepPos,
  stepTarget,
  touchPlace,
  touchStep,
  wheelPixels,
} from "./model";

export interface MotionHooks {
  /** Draw the stage at `pos`. Only transforms and opacities are written. */
  frame(pos: number): void;
  /** The picture in front changed (halfway through a move). `instant`: the stage jumped, nothing moved. */
  active(index: number, instant: boolean): void;
  /** The place came to rest. */
  rest(): void;
  /** The entrance glide has landed on the first picture. */
  landed(): void;
}

interface Touch {
  id: number;
  y0: number;
  /** The place the finger took hold of. */
  base: number;
  moved: boolean;
}

export class SplashMotion {
  private pos: number;
  private target: number;
  private raf = 0;
  private last = 0;
  private shown = -1;
  private gliding = false;
  private dead = false;
  private touch: Touch | null = null;
  private readonly gate = new WheelGate();

  constructor(
    private readonly count: number,
    start: number,
    private readonly hooks: MotionHooks,
  ) {
    this.pos = start;
    this.target = start;
  }

  /** Draw the first frame and say which picture is in front. */
  begin(): void {
    this.draw();
  }

  /** The entrance is running: input waits for it. */
  get entering(): boolean {
    return this.gliding;
  }

  /** The picture the stage is on, or going to. */
  restingIndex(): number {
    return activeOf(this.target, this.count);
  }

  /** The place and the target, for the probe. */
  snapshot(): { pos: number; target: number; running: boolean } {
    return { pos: this.pos, target: this.target, running: this.raf !== 0 };
  }

  /** Start three places down and glide to the picture the stage rests on. */
  enter(): void {
    this.gliding = true;
    this.pos = this.target + ENTRANCE_FROM;
    this.draw();
    this.kick();
  }

  /** One picture on (`1`) or back (`-1`). Pressed again while it moves, it goes one further. */
  step(dir: 1 | -1): void {
    if (this.gliding || this.touch?.moved) return;
    this.target = limitLead(stepTarget(this.target, dir), this.pos);
    this.kick();
  }

  /** Glide to picture `index`, the short way round. */
  goTo(index: number): void {
    if (this.gliding || this.touch?.moved) return;
    this.target = slotOf(index, this.target, this.count);
    this.kick();
  }

  /** Stand on picture `index` at once, with no glide. */
  jumpTo(index: number): void {
    const slot = slotOf(index, this.target, this.count);
    this.pos = slot;
    this.target = slot;
    this.draw(true);
    this.hooks.rest();
  }

  /** A wheel turn. Returns true when it made a step. */
  wheel(deltaY: number, deltaMode: number, t: number, screen: number): boolean {
    if (this.gliding || this.touch) return false;
    const dir = this.gate.feed(t, wheelPixels(deltaY, deltaMode, screen));
    if (dir === 0) return false;
    this.step(dir);
    return true;
  }

  /** A finger lands. */
  touchDown(id: number, y: number): void {
    if (this.gliding || this.touch) return;
    this.touch = { id, y0: y, base: Math.round(this.target), moved: false };
  }

  /** The finger moves. Returns true once the touch has become a drag. */
  touchMove(id: number, y: number): boolean {
    const t = this.touch;
    if (t?.id !== id) return false;
    const dy = y - t.y0;
    if (!t.moved) {
      if (Math.abs(dy) <= TAP_PX) return false;
      t.moved = true;
    }
    this.target = t.base + touchPlace(dy);
    this.kick();
    return true;
  }

  /** The finger lets go. Returns `tap` when it never moved, `drag` when it did. */
  touchUp(id: number, y: number): "tap" | "drag" | null {
    const t = this.touch;
    if (t?.id !== id) return null;
    this.touch = null;
    if (!t.moved) return "tap";
    this.target = t.base + touchStep(y - t.y0);
    this.kick();
    return "drag";
  }

  /** The browser took the touch away: go back to where it started. */
  touchCancel(id: number): void {
    const t = this.touch;
    if (t?.id !== id) return;
    this.touch = null;
    if (!t.moved) return;
    this.target = t.base;
    this.kick();
  }

  /** The screen changed shape: draw again where the stage is. */
  redraw(): void {
    this.draw();
  }

  /** For frame sheets: draw the stage at `pos` without moving it, or where it is when `pos` is null. */
  peek(pos: number | null): void {
    this.hooks.frame(pos ?? this.pos);
  }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // ---------------------------------------------------------------------------------------------

  private kick(): void {
    if (this.raf || this.dead) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    this.raf = 0;
    if (this.dead) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.pos = stepPos(this.pos, this.target, dt, this.touch?.moved ? LAMBDA_DRAG : LAMBDA);
    this.draw();
    if (this.gliding && Math.abs(this.target - this.pos) < LAND_AT) this.land();
    if (this.pos !== this.target) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    this.settle();
  };

  private settle(): void {
    // Keep the numbers small: only the offsets matter, and they do not change.
    if (Math.abs(this.pos) > 4 * this.count) {
      const moved = rebase(this.pos, this.target, this.count);
      this.pos = moved.pos;
      this.target = moved.target;
    }
    this.hooks.rest();
    if (this.gliding) this.land();
  }

  /** The entrance has landed: input is open and the caption may arrive. */
  private land(): void {
    this.gliding = false;
    this.hooks.landed();
  }

  private draw(instant = false): void {
    this.hooks.frame(this.pos);
    const index = activeOf(this.pos, this.count);
    if (index !== this.shown) {
      this.shown = index;
      this.hooks.active(index, instant);
    }
  }
}
