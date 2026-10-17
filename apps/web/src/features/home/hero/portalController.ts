import type { PointerState } from "@/lib/hooks";
import { clamp, damp } from "@/lib/math";

/**
 * Per-frame state of the portal hero, in CSS px relative to the hero box. Written by the
 * controller's rAF tick, read by the WebGL scene (uniforms) and by the static fallback
 * (CSS mask variables). Never stored in React state.
 */
export interface PortalFrame {
  /** Hero size. */
  w: number;
  h: number;
  /** Figure box (4:5) inside the hero. */
  figX: number;
  figY: number;
  figW: number;
  figH: number;
  /** Portal centre and radius (follows the smoothed pointer). */
  cx: number;
  cy: number;
  r: number;
  /** Form wipe: a circle that grows from (fx, fy) until the other form covers the hero. */
  fx: number;
  fy: number;
  fr: number;
  /** 0 to 1 progress of the form wipe (1 = the other form is shown). */
  form: number;
  /** `form` through the wipe easing. */
  formE: number;
  /** Damped pointer for the pseudo camera, -1 to 1. */
  camX: number;
  camY: number;
  /** Smoothed pointer speed, 0 to 1. Roughens the rim. */
  energy: number;
  /** Pair transition: 0 shown, 1 dissolved. */
  dissolve: number;
  /** Index of the pair that is drawn. */
  pair: number;
  /** Intro reveal, 0 to 1. */
  intro: number;
  time: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Drives the portal: pointer to portal radius (fast rise toward a speed-mapped size, slow
 * relax when idle), hold, the form wipe and the pair dissolve. One instance per hero.
 */
export class PortalController {
  readonly f: PortalFrame = {
    w: 1,
    h: 1,
    figX: 0,
    figY: 0,
    figW: 1,
    figH: 1.25,
    cx: 0,
    cy: 0,
    r: 0,
    fx: 0,
    fy: 0,
    fr: 0,
    form: 0,
    formE: 0,
    camX: 0,
    camY: 0,
    energy: 0,
    dissolve: 0,
    pair: 0,
    intro: 0,
    time: 0,
  };

  reduced = false;
  /** Write the CSS mask variables (no WebGL). */
  cssMask = true;
  /** Returns true when the textures of a pair are loaded (set by the scene). */
  isPairReady: (index: number) => boolean = () => true;
  /** Called when the drawn pair changes (at the middle of the dissolve). */
  onSwap: ((index: number) => void) | null = null;

  private hero: HTMLElement | null = null;
  private figure: HTMLElement | null = null;
  private readout: HTMLElement | null = null;
  private pointer: { readonly current: PointerState } | null = null;
  private hold = false;
  private holdUv: readonly [number, number] = [0.5, 0.3];
  private align: readonly [number, number] = [0, 0];
  private formTarget = 0;
  private pairTarget = 0;
  private introTarget = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastMove = -1e9;
  private mirrorAt = 0;
  private lastMirror = "";

  attach(hero: HTMLElement, figure: HTMLElement, readout: HTMLElement | null): () => void {
    this.hero = hero;
    this.figure = figure;
    this.readout = readout;
    this.measure();
    const ro = new ResizeObserver(() => this.measure());
    ro.observe(hero);
    ro.observe(figure);
    return () => {
      ro.disconnect();
      this.hero = null;
      this.figure = null;
    };
  }

  usePointerSource(pointer: { readonly current: PointerState }): void {
    this.pointer = pointer;
  }

  measure(): void {
    const hero = this.hero;
    const figure = this.figure;
    if (!hero || !figure) return;
    const h = hero.getBoundingClientRect();
    const r = figure.getBoundingClientRect();
    const f = this.f;
    f.w = h.width;
    f.h = h.height;
    f.figX = r.left - h.left;
    f.figY = r.top - h.top;
    f.figW = Math.max(1, r.width);
    f.figH = Math.max(1, r.height);
  }

  /** Hold the portal open over the face. `uv` is the base face, `align` the face offset. */
  setHold(on: boolean, uv: readonly [number, number], align: readonly [number, number]): void {
    this.hold = on;
    this.holdUv = uv;
    this.align = align;
  }

  /** The face on screen, in hero px (it moves with the form, see `align`). */
  private face(): { x: number; y: number } {
    const f = this.f;
    return {
      x: f.figX + (this.holdUv[0] + this.align[0] * f.formE) * f.figW,
      y: f.figY + (this.holdUv[1] + this.align[1] * f.formE) * f.figH,
    };
  }

  /** Show the other form (true) or the base form (false). `origin` in hero px. */
  setForm(alt: boolean, origin?: { x: number; y: number }): void {
    const f = this.f;
    const target = alt ? 1 : 0;
    if (target === this.formTarget) return;
    // Move the origin only when the circle is fully open or closed (no visible jump).
    if (f.form <= 0.001 || f.form >= 0.999) {
      const at = origin ?? this.face();
      f.fx = at.x;
      f.fy = at.y;
    }
    this.formTarget = target;
  }

  setPair(index: number): void {
    this.pairTarget = index;
  }

  playIntro(): void {
    this.introTarget = 1;
  }

  /** Advance one frame. `dt` in seconds, `now` in seconds. */
  tick(dt: number, now: number): void {
    const f = this.f;
    const hero = this.hero;
    if (!hero) return;
    f.time += dt;
    const rect = hero.getBoundingClientRect();
    f.w = rect.width;
    f.h = rect.height;
    const p = this.pointer?.current;
    const reduced = this.reduced;

    // Pointer to portal ------------------------------------------------------------------
    let inside = false;
    let lx = 0;
    let ly = 0;
    if (p) {
      if (p.clientX !== this.lastX || p.clientY !== this.lastY) {
        this.lastX = p.clientX;
        this.lastY = p.clientY;
        this.lastMove = now;
      }
      lx = p.clientX - rect.left;
      ly = p.clientY - rect.top;
      inside = p.active && lx >= 0 && ly >= 0 && lx <= rect.width && ly <= rect.height;
      f.camX = damp(f.camX, reduced ? 0 : clamp(p.x, -1, 1), 2.6, dt);
      f.camY = damp(f.camY, reduced ? 0 : clamp(p.y, -1, 1), 2.6, dt);
      f.energy = damp(f.energy, reduced ? 0 : clamp(p.speed / 1800), 4, dt);
    }

    const unit = Math.min(f.w, f.h);
    let tr = 0;
    let tx = f.cx;
    let ty = f.cy;
    if (this.hold) {
      tr = unit * 0.2;
      const at = this.face();
      tx = at.x;
      ty = at.y;
    } else if (!reduced && inside && now - this.lastMove < 1.4 && p) {
      const s = clamp((p.speed - 30) / 1500);
      const eased = 1 - (1 - s) * (1 - s);
      const dx = Math.max(f.figX - lx, 0, lx - (f.figX + f.figW));
      const dy = Math.max(f.figY - ly, 0, ly - (f.figY + f.figH));
      const prox = 1 - clamp(Math.hypot(dx, dy) / (unit * 0.4)) * 0.55;
      const pilot = unit * 0.035;
      tr = (pilot + (unit * 0.26 - pilot) * eased) * prox;
      tx = lx;
      ty = ly;
    }
    if (f.r < 2) {
      f.cx = tx;
      f.cy = ty;
    } else {
      const follow = this.hold ? 6 : 13;
      f.cx = damp(f.cx, tx, follow, dt);
      f.cy = damp(f.cy, ty, follow, dt);
    }
    if (reduced) f.r = tr;
    else f.r = tr > f.r ? damp(f.r, tr, 8, dt) : damp(f.r, tr, this.hold ? 6 : 1.7, dt);
    if (tr === 0 && f.r < 0.4) f.r = 0;

    // Form wipe --------------------------------------------------------------------------
    if (reduced) f.form = this.formTarget;
    else {
      const step = dt / 1.15;
      f.form =
        this.formTarget > f.form
          ? Math.min(this.formTarget, f.form + step)
          : Math.max(this.formTarget, f.form - step);
    }
    const far = Math.max(
      Math.hypot(f.fx, f.fy),
      Math.hypot(f.w - f.fx, f.fy),
      Math.hypot(f.fx, f.h - f.fy),
      Math.hypot(f.w - f.fx, f.h - f.fy),
    );
    f.formE = easeInOut(f.form);
    f.fr = f.formE * (far + 80);

    // Pair dissolve ----------------------------------------------------------------------
    if (this.pairTarget !== f.pair) {
      f.dissolve = reduced ? 1 : Math.min(1, f.dissolve + dt / 0.42);
      if (f.dissolve >= 1 && this.isPairReady(this.pairTarget)) {
        f.pair = this.pairTarget;
        f.form = 0;
        f.formE = 0;
        f.fr = 0;
        this.formTarget = 0;
        this.onSwap?.(f.pair);
      }
    } else {
      f.dissolve = reduced ? 0 : Math.max(0, f.dissolve - dt / 0.6);
    }

    // Intro ------------------------------------------------------------------------------
    f.intro = reduced
      ? this.introTarget
      : this.introTarget > f.intro
        ? Math.min(1, f.intro + dt / 1.6)
        : f.intro;

    if (this.cssMask) this.writeMask();
    if (now - this.mirrorAt > 0.1) {
      this.mirrorAt = now;
      this.mirror();
    }
  }

  /** CSS variables for the static fallback: the portal and the wipe, relative to the figure. */
  private writeMask(): void {
    const hero = this.hero;
    if (!hero) return;
    const f = this.f;
    const s = hero.style;
    s.setProperty("--portal-x", `${(f.cx - f.figX).toFixed(1)}px`);
    s.setProperty("--portal-y", `${(f.cy - f.figY).toFixed(1)}px`);
    s.setProperty("--portal-r", `${f.r.toFixed(1)}px`);
    s.setProperty("--wipe-x", `${(f.fx - f.figX).toFixed(1)}px`);
    s.setProperty("--wipe-y", `${(f.fy - f.figY).toFixed(1)}px`);
    s.setProperty("--wipe-r", `${f.fr.toFixed(1)}px`);
    s.setProperty("--dissolve", f.dissolve.toFixed(3));
  }

  /** Low-rate mirror to DOM attributes (tests, HUD readout). */
  private mirror(): void {
    const hero = this.hero;
    if (!hero) return;
    const r = Math.round(this.f.r);
    const key = `${r}`;
    if (key === this.lastMirror) return;
    this.lastMirror = key;
    hero.dataset.portalRadius = key;
    if (this.readout) this.readout.textContent = String(r).padStart(3, "0");
  }
}
