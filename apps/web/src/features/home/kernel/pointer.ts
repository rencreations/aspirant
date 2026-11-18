/**
 * The pointer of the home page, at window level. The canvas takes no pointer events, so a press or a
 * move reaches the window through whatever DOM is under it, and the kernel asks the registered 3D
 * targets whether the pointer is on one. Rules:
 *
 *  - a DOM control under the pointer (a link, a button, a field, `[data-home-hit="dom"]`) always
 *    wins: no 3D target is asked and the site's cursor shows the control's own label;
 *  - among the 3D targets the nearest hit wins (smaller depth);
 *  - a touch has no hover: a target is found at the press and let go at the release;
 *  - the cursor label of the winning target goes to the site's cursor through `CursorApi`.
 *
 * The state is resolved once per frame (`resolve`), not per event, so it also follows the scroll
 * moving under a pointer that is still.
 */
import type { CursorApi, HitTarget, PointerApi, PointerState } from "./types";

/** What counts as a control of the page: the pointer is on the DOM, not on a 3D target. */
const DOM_HIT =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [data-home-hit="dom"]';

/** True when `target` is, or is inside, a control the DOM owns. */
export function isDomControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(DOM_HIT) !== null;
}

/** The nearest hit among `targets` at a point, or null. Ties go to the one registered first. */
export function nearestHit(
  targets: Iterable<HitTarget>,
  x: number,
  y: number,
): { target: HitTarget; depth: number } | null {
  let best: { target: HitTarget; depth: number } | null = null;
  for (const target of targets) {
    const depth = target.test(x, y);
    if (depth === null) continue;
    if (!best || depth < best.depth) best = { target, depth };
  }
  return best;
}

export class PointerHub implements PointerApi {
  readonly state: PointerState = {
    x: 0,
    y: 0,
    nx: 0,
    ny: 0,
    down: false,
    type: "mouse",
    inside: false,
    speed: 0,
    hit: null,
  };

  private readonly targets = new Set<HitTarget>();
  private current: HitTarget | null = null;
  private overDom = false;
  private pressed: HitTarget | null = null;
  private lastMove = 0;
  private attached = false;

  constructor(private readonly cursor: CursorApi) {}

  add(target: HitTarget): () => void {
    this.targets.add(target);
    return () => {
      this.targets.delete(target);
      if (this.current === target) this.setCurrent(null);
      if (this.pressed === target) this.pressed = null;
    };
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerdown", this.onDown, { passive: true });
    window.addEventListener("pointerup", this.onUp, { passive: true });
    window.addEventListener("pointercancel", this.onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", this.onLeave, { passive: true });
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    document.documentElement.removeEventListener("pointerleave", this.onLeave);
    this.setCurrent(null);
  }

  /** Ask the targets once for this frame. Call it every frame (it is cheap and does nothing when idle). */
  resolve(dt: number): void {
    const s = this.state;
    // The speed decays when the pointer rests.
    s.speed *= Math.exp(-6 * Math.max(0, dt));
    if (s.speed < 1) s.speed = 0;

    const live = s.inside || s.down;
    if (!live || this.overDom) {
      if (this.current) this.setCurrent(null);
      return;
    }
    if (s.type === "touch" && !s.down) {
      if (this.current) this.setCurrent(null);
      return;
    }
    // Targets move under a still pointer too (the scene scrolls), so ask every frame while live.
    const hit = nearestHit(this.targets, s.x, s.y);
    const next = hit?.target ?? null;
    if (next !== this.current) this.setCurrent(next);
    else next?.move?.(s.x, s.y);
  }

  private setCurrent(next: HitTarget | null): void {
    const previous = this.current;
    if (previous === next) return;
    this.current = next;
    this.state.hit = next?.id ?? null;
    previous?.leave?.();
    next?.enter?.();
    this.cursor.set(next?.cursor ?? null);
  }

  private read(e: PointerEvent): void {
    const s = this.state;
    s.type = e.pointerType === "touch" || e.pointerType === "pen" ? e.pointerType : "mouse";
    s.x = e.clientX;
    s.y = e.clientY;
    s.nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    s.ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
    this.overDom = isDomControl(e.target);
  }

  private readonly onMove = (e: PointerEvent): void => {
    const s = this.state;
    const now = performance.now();
    const dtMs = Math.max(1, now - this.lastMove);
    this.lastMove = now;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    s.speed = Math.min(6000, s.speed * 0.5 + (Math.hypot(dx, dy) / dtMs) * 1000 * 0.5);
    this.read(e);
    s.inside = true;
  };

  private readonly onDown = (e: PointerEvent): void => {
    this.read(e);
    const s = this.state;
    s.down = true;
    s.inside = true;
    if (this.overDom) return;
    // A touch finds its target at the press.
    const hit = nearestHit(this.targets, s.x, s.y);
    const target = hit?.target ?? null;
    if (target !== this.current) this.setCurrent(target);
    this.pressed = target;
    target?.press?.(s.x, s.y);
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.read(e);
    const s = this.state;
    s.down = false;
    const pressed = this.pressed;
    this.pressed = null;
    pressed?.release?.(s.x, s.y);
    if (s.type === "touch") {
      s.inside = false;
      this.setCurrent(null);
    }
  };

  private readonly onLeave = (): void => {
    this.state.inside = false;
    this.setCurrent(null);
  };
}
