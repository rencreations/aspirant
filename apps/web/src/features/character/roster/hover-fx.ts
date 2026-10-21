import { prefersReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";

/**
 * What a panel does while the pointer is on it: it is marked `data-hover` (the stylesheet reads it
 * to take the haze off and colour the rim), and the picture slides against the pointer in two
 * dimensions, eased, so it seems to sit behind the frame. Nothing is drawn over it and nothing
 * changes its colour. When the pointer leaves, the picture eases back to rest.
 *
 * One panel at a time runs this, in one animation frame loop that stops when the panel has settled.
 * Only `transform` is written, and the box of the panel is read a few times a second, not on every
 * move.
 */
interface Fx {
  li: HTMLElement;
  pic: HTMLElement | null;
  /** The pointer, from -0.5 to 0.5 across and down the panel, now and eased. */
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  /** 0 off the panel, 1 on it. */
  k: number;
  goal: number;
  left: number;
  top: number;
  w: number;
  h: number;
  at: number;
}

/** How far the picture slides, in px, from one side of the panel to the other. */
const FOLLOW = { x: 56, y: 34 };
const SCALE = 0.04;

export function createHoverFx() {
  let fx: Fx | null = null;
  let leaving: Fx | null = null;
  let raf = 0;

  const moves = () => !prefersReducedMotion();

  const write = (f: Fx) => {
    if (!f.pic) return;
    const k = f.k;
    f.pic.style.transform = `translate3d(${(-f.nx * FOLLOW.x * k).toFixed(1)}px,${(-f.ny * FOLLOW.y * k).toFixed(1)}px,0) scale(${(1 + SCALE * k).toFixed(4)})`;
  };

  const clear = (f: Fx) => {
    if (f.pic) {
      f.pic.style.transform = "";
      f.pic.style.transition = "";
      f.pic.style.willChange = "";
    }
    delete f.li.dataset.hover;
  };

  const frame = () => {
    raf = 0;
    let busy = false;
    for (const f of [fx, leaving]) {
      if (!f) continue;
      f.nx += (f.tx - f.nx) * 0.14;
      f.ny += (f.ty - f.ny) * 0.14;
      f.k += (f.goal - f.k) * 0.12;
      write(f);
      if (f.goal === 0 && f.k < 0.004) {
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
    /** The pointer came onto a panel (or moved onto one from another). */
    enter(li: HTMLElement, x: number, y: number) {
      if (fx?.li === li) return;
      if (fx) this.leave();
      // The frame is lit at once, whatever the device.
      li.dataset.hover = "true";
      if (!moves()) return;
      if (leaving?.li === li) {
        fx = leaving;
        leaving = null;
      } else {
        const pic = li.querySelector<HTMLElement>("[data-fx='pic']");
        const r = li.getBoundingClientRect();
        fx = {
          li,
          pic,
          tx: 0,
          ty: 0,
          nx: 0,
          ny: 0,
          k: 0,
          goal: 1,
          left: r.left,
          top: r.top,
          w: r.width,
          h: r.height,
          at: performance.now(),
        };
        // The eased writes take the place of the stylesheet's own transition.
        if (pic) {
          pic.style.transition = "none";
          pic.style.willChange = "transform";
        }
      }
      fx.goal = 1;
      this.move(x, y);
      fx.nx = fx.tx;
      fx.ny = fx.ty;
      run();
    },
    /** The pointer moved on the panel. */
    move(x: number, y: number) {
      if (!fx) return;
      const now = performance.now();
      if (now - fx.at > 200) {
        const r = fx.li.getBoundingClientRect();
        fx.left = r.left;
        fx.top = r.top;
        fx.w = r.width;
        fx.h = r.height;
        fx.at = now;
      }
      fx.tx = clamp((x - fx.left) / fx.w - 0.5, -0.5, 0.5);
      fx.ty = clamp((y - fx.top) / fx.h - 0.5, -0.5, 0.5);
      run();
    },
    /** The pointer left it: the picture eases back to rest. */
    leave() {
      if (!fx) return;
      fx.goal = 0;
      fx.tx = 0;
      fx.ty = 0;
      // The frame goes back to its shade at once, with the stylesheet's own fade.
      delete fx.li.dataset.hover;
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
