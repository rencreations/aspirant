/**
 * The visitor's hands on the stage: what a drag, a wheel, a pinch or two fingers do. It turns them
 * into small changes (a turn, a zoom, a pan) and hands them to the stage, which keeps the limits of
 * the view. No three here.
 *
 * - One finger or the left button: turn.
 * - The wheel, a trackpad pinch (a wheel with Ctrl) or two fingers pinching: zoom.
 * - Two fingers moving together, the right or middle button, or Shift with the left: pan (only
 *   where the view allows it).
 *
 * A turn keeps going for a moment after the finger leaves and slows down (inertia). The canvas takes
 * `touch-action: none`, so a touch never scrolls the page: the room does not scroll.
 */
export interface RigSink {
  /** Turn by these fractions of the stage's height (x to the right, y down). */
  turn: (dx: number, dy: number) => void;
  /** Zoom by this factor: under 1 comes closer. */
  zoom: (factor: number) => void;
  /** Pan by these fractions of the stage's height. */
  pan: (dx: number, dy: number) => void;
  /** The visitor touched the stage (the first move of a gesture). */
  begin: () => void;
}

interface Pointer {
  x: number;
  y: number;
  button: number;
  shift: boolean;
}

const INERTIA_DECAY = 5.5;
const MIN_SPEED = 0.002;

export class Rig {
  private readonly el: HTMLElement;
  private readonly sink: RigSink;
  private readonly pointers = new Map<number, Pointer>();
  private pinch: { distance: number; mx: number; my: number } | null = null;
  /** The turn's speed, in fractions of the height a second, for the inertia. */
  private vx = 0;
  private vy = 0;
  private lastMove = 0;
  private began = false;
  private disposed = false;

  constructor(el: HTMLElement, sink: RigSink) {
    this.el = el;
    this.sink = sink;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("lostpointercapture", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", this.onContext);
  }

  /** True while a finger is down or the inertia is still turning. */
  get active(): boolean {
    return this.pointers.size > 0 || Math.hypot(this.vx, this.vy) > MIN_SPEED;
  }

  /** Called once a frame: the inertia after a release. */
  update(dt: number): boolean {
    if (this.pointers.size > 0) return true;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed <= MIN_SPEED) {
      this.vx = 0;
      this.vy = 0;
      return false;
    }
    this.sink.turn(this.vx * dt, this.vy * dt);
    const k = Math.exp(-INERTIA_DECAY * dt);
    this.vx *= k;
    this.vy *= k;
    return true;
  }

  /** Stop any inertia (a reset, a new view). */
  halt(): void {
    this.vx = 0;
    this.vy = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const el = this.el;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("lostpointercapture", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("contextmenu", this.onContext);
  }

  private get unit(): number {
    return Math.max(1, this.el.clientHeight);
  }

  private start(): void {
    if (this.began) return;
    this.began = true;
    this.sink.begin();
  }

  private readonly onContext = (e: Event) => {
    // The right button pans; its menu would cover the stage.
    e.preventDefault();
  };

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button > 2) return;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that is already gone: nothing to capture.
    }
    this.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      shift: e.shiftKey,
    });
    this.vx = 0;
    this.vy = 0;
    this.began = false;
    this.pinch = this.pointers.size === 2 ? this.measure() : null;
  };

  private measure(): { distance: number; mx: number; my: number } | null {
    const [a, b] = Array.from(this.pointers.values());
    if (!a || !b) return null;
    return {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  }

  private readonly onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (dx === 0 && dy === 0) return;
    const u = this.unit;
    if (this.pointers.size >= 2) {
      const now = this.measure();
      if (!now || !this.pinch) {
        this.pinch = now;
        return;
      }
      this.start();
      this.sink.zoom(this.pinch.distance / now.distance);
      this.sink.pan((now.mx - this.pinch.mx) / u, (now.my - this.pinch.my) / u);
      this.pinch = now;
      return;
    }
    this.start();
    const panning = p.button === 1 || p.button === 2 || p.shift;
    if (panning) {
      this.sink.pan(dx / u, dy / u);
      return;
    }
    this.sink.turn(dx / u, dy / u);
    // The speed for the inertia, smoothed over the last moves.
    const t = performance.now();
    const step = Math.max(1, t - this.lastMove) / 1000;
    this.lastMove = t;
    const k = 0.35;
    this.vx = this.vx * (1 - k) + (dx / u / step) * k;
    this.vy = this.vy * (1 - k) + (dy / u / step) * k;
  };

  private readonly onUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    this.pinch = this.pointers.size === 2 ? this.measure() : null;
    // A release after a pause is a stop, not a throw.
    if (performance.now() - this.lastMove > 80 || this.pointers.size > 0) {
      this.vx = 0;
      this.vy = 0;
    }
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.start();
    this.began = false;
    const lines = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.unit : 1;
    const delta = e.deltaY * lines;
    // A trackpad pinch arrives as a wheel with Ctrl: its steps are small, so it is given more weight.
    const rate = e.ctrlKey ? 0.01 : 0.0012;
    this.sink.zoom(Math.exp(Math.max(-0.5, Math.min(0.5, delta * rate))));
  };
}
