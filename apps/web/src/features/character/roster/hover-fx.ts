import { prefersReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";
import { perfLevel } from "@/lib/perf";

/**
 * What a panel does while the pointer is on it, and only then.
 *
 * The panel is marked as hovered (`data-hover` on its `<li>`, which the stylesheet reads to lift the
 * frame, take the haze off and colour the rim), the picture follows the pointer in two dimensions
 * (it slides against it, so it seems to sit behind the frame), the name tag slides a little the
 * other way, and a soft light follows the pointer. On top of that the picture idles the way the
 * animated cards of the game do: it floats and sways on two slow rhythms that never quite line
 * up. All of it eases in when the pointer arrives and out when it
 * leaves.
 *
 * One panel at a time runs this, in one animation frame loop that stops when the panel has settled.
 * Only `transform` is written. The sparkles, light streaks and glow that go with it are in the
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
  w: number;
  h: number;
  /** The box of the panel on the screen, read now and then and not on every move. */
  left: number;
  top: number;
  at: number;
  /** Shifts the rhythm of the idle motion, so two panels never sway together. */
  phase: number;
  /** Movement is on (not the lightest level, not reduced motion). */
  moving: boolean;
}

const FOLLOW = { x: 30, y: 19, zoom: 0.06 };
const TAG = { x: 9, y: 5 };
/** The idle sway, as a share of the panel: sideways, up and down. */
const SWAY = { x: 0.016, y: 0.022 };

export function createHoverFx() {
  let fx: Fx | null = null;
  let raf = 0;
  /** A panel that has been left and is still easing back. */
  let leaving: Fx | null = null;

  const canMove = () => !prefersReducedMotion() && perfLevel() !== "lite";

  const write = (f: Fx, now: number) => {
    const k = f.k;
    let swayX = 0;
    let swayY = 0;
    if (f.moving) {
      const t = now / 1000 + f.phase;
      swayX = (0.7 * Math.sin(t * 0.9) + 0.3 * Math.sin(t * 2.1 + 1)) * SWAY.x * f.w;
      swayY = (0.65 * Math.sin(t * 1.15 + 0.5) + 0.35 * Math.sin(t * 2.7)) * SWAY.y * f.h;
    }
    if (f.tilt && f.moving) {
      const x = -f.nx * FOLLOW.x * k + swayX * k;
      const y = -f.ny * FOLLOW.y * k + swayY * k;
      // The scale only changes while the pointer arrives or leaves: a scale that changes on every
      // frame would make the browser draw the whole picture again on every frame.
      const s = 1 + FOLLOW.zoom * k;
      f.tilt.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
    }
    if (f.tag && f.moving) {
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
      el.style.willChange = "";
    }
    delete f.li.dataset.hover;
  };

  const frame = (now: number) => {
    raf = 0;
    let busy = false;
    for (const f of [fx, leaving]) {
      if (!f) continue;
      f.nx += (f.tx - f.nx) * 0.14;
      f.ny += (f.ty - f.ny) * 0.14;
      f.sx += (f.px - f.sx) * 0.3;
      f.sy += (f.py - f.sy) * 0.3;
      f.k += (f.goal - f.k) * 0.1;
      write(f, now);
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
      // The frame is lit at once, whatever the device: only the movement is for a device with room.
      li.dataset.hover = "true";
      if (leaving?.li === li) {
        fx = leaving;
        leaving = null;
      } else {
        const tilt = li.querySelector<HTMLElement>("[data-fx='tilt']");
        const tag = li.querySelector<HTMLElement>("[data-fx='tag']");
        const spot = li.querySelector<HTMLElement>("[data-fx='spot']");
        const r = li.getBoundingClientRect();
        const moving = canMove();
        fx = {
          li,
          tilt,
          tag,
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
          w: r.width,
          h: r.height,
          left: r.left,
          top: r.top,
          at: performance.now(),
          phase: Math.random() * 20,
          moving,
        };
        // The eased writes take the place of the stylesheet's own transition.
        if (moving) for (const el of [tilt, tag]) if (el) el.style.transition = "none";
        // Its own layer, but only while the pointer is on it.
        if (moving && tilt) tilt.style.willChange = "transform";
        if (spot) spot.style.transition = "none";
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
      // Reading the box makes the browser lay the page out, so it is read a few times a second (the
      // panel moves only when the row scrolls).
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
      fx.px = x - fx.left;
      fx.py = y - fx.top;
      run();
    },
    /** The pointer left it: it eases back to rest. */
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
