import { prefersReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";
import { perfLevel } from "@/lib/perf";

/**
 * What a panel does while the pointer is on it, and only then. The picture slides against the
 * pointer (so it seems to sit behind the frame), the name tag slides a little the other way (so it
 * seems to float in front), and a soft light follows the pointer. Everything eases in on the way
 * in and out on the way off. One panel at a time runs this, in one animation frame loop that stops
 * when the panel has settled. Only `transform` is written.
 *
 * The overlays that make it look deeper (light streaks, specks of light, a vignette) are in the
 * stylesheet and run on the compositor while the panel is hovered.
 */
interface Fx {
  li: HTMLElement;
  tilt: HTMLElement | null;
  tag: HTMLElement | null;
  spot: HTMLElement | null;
  /** The pointer, from -0.5 to 0.5 across and down the panel, and where it is in px. */
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  sx: number;
  sy: number;
  px: number;
  py: number;
  /** 0 off the panel, 1 on it. */
  k: number;
  goal: number;
  half: number;
}

const PICTURE = { x: 38, y: 24, zoom: 0.07 };
const TAG = { x: 9, y: 5 };

export function createHoverFx() {
  let fx: Fx | null = null;
  let raf = 0;
  /** A panel that has been left and is still easing back. */
  let leaving: Fx | null = null;

  const enabled = () => !prefersReducedMotion() && perfLevel() !== "lite";

  const write = (f: Fx) => {
    const k = f.k;
    if (f.tilt) {
      f.tilt.style.transform = `translate3d(${(-f.nx * PICTURE.x * k).toFixed(1)}px,${(-f.ny * PICTURE.y * k).toFixed(1)}px,0) scale(${(1 + PICTURE.zoom * k).toFixed(4)})`;
    }
    if (f.tag) {
      f.tag.style.transform = `translate3d(${(f.nx * TAG.x * k).toFixed(1)}px,${(f.ny * TAG.y * k).toFixed(1)}px,0)`;
    }
    if (f.spot) {
      f.spot.style.transform = `translate3d(${(f.sx - f.half).toFixed(1)}px,${(f.sy - f.half).toFixed(1)}px,0)`;
    }
  };

  const clear = (f: Fx) => {
    for (const el of [f.tilt, f.tag, f.spot]) {
      if (!el) continue;
      el.style.transform = "";
      el.style.transition = "";
    }
  };

  const frame = () => {
    raf = 0;
    let busy = false;
    for (const f of [fx, leaving]) {
      if (!f) continue;
      f.nx += (f.tx - f.nx) * 0.14;
      f.ny += (f.ty - f.ny) * 0.14;
      f.sx += (f.px - f.sx) * 0.3;
      f.sy += (f.py - f.sy) * 0.3;
      f.k += (f.goal - f.k) * 0.12;
      write(f);
      const settled =
        Math.abs(f.tx - f.nx) + Math.abs(f.ty - f.ny) < 0.002 && Math.abs(f.goal - f.k) < 0.004;
      if (f.goal === 0 && settled) {
        clear(f);
        if (f === leaving) leaving = null;
      } else busy = true;
    }
    if (busy) raf = requestAnimationFrame(frame);
  };

  const run = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  return {
    /** The pointer came onto a panel. */
    enter(li: HTMLElement, x: number, y: number) {
      if (!enabled()) return;
      if (fx && fx.li !== li) this.leave();
      if (leaving?.li === li) {
        fx = leaving;
        leaving = null;
      } else {
        const tilt = li.querySelector<HTMLElement>("[data-fx='tilt']");
        const spot = li.querySelector<HTMLElement>("[data-fx='spot']");
        fx = {
          li,
          tilt,
          tag: li.querySelector<HTMLElement>("[data-fx='tag']"),
          spot,
          tx: 0,
          ty: 0,
          nx: 0,
          ny: 0,
          sx: 0,
          sy: 0,
          px: 0,
          py: 0,
          k: 0,
          goal: 1,
          half: (spot?.offsetWidth ?? 0) / 2,
        };
        // The eased writes below take the place of the stylesheet's own transition.
        for (const el of [tilt, fx.tag, spot]) if (el) el.style.transition = "none";
      }
      fx.goal = 1;
      this.move(x, y);
      fx.sx = fx.px;
      fx.sy = fx.py;
      run();
    },
    /** The pointer moved on the panel. */
    move(x: number, y: number) {
      if (!fx) return;
      const r = fx.li.getBoundingClientRect();
      fx.tx = clamp((x - r.left) / r.width - 0.5, -0.5, 0.5);
      fx.ty = clamp((y - r.top) / r.height - 0.5, -0.5, 0.5);
      fx.px = x - r.left;
      fx.py = y - r.top;
      run();
    },
    /** The pointer left it: it eases back to rest. */
    leave() {
      if (!fx) return;
      fx.goal = 0;
      fx.tx = 0;
      fx.ty = 0;
      if (leaving && leaving !== fx) clear(leaving);
      leaving = fx;
      fx = null;
      run();
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (fx) clear(fx);
      if (leaving) clear(leaving);
      fx = null;
      leaving = null;
    },
  };
}
