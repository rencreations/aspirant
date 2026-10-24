"use client";

import { useEffect, type RefObject } from "react";

/**
 * Moves every `[data-depth]` layer of a stage a few pixels with the pointer, with some lag. The
 * layers are wrappers that carry no transition of their own, so the loop writes one transform per
 * layer and stops by itself once the layers have caught up with the pointer.
 */
export function useParallax(stage: RefObject<HTMLElement | null>, on: boolean) {
  useEffect(() => {
    const root = stage.current;
    if (!root || !on) return;
    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]"), (el) => ({
      el,
      depth: Number(el.dataset.depth),
    }));
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };
    let raf = 0;

    const tick = () => {
      now.x += (target.x - now.x) * 0.08;
      now.y += (target.y - now.y) * 0.08;
      for (const l of layers) {
        l.el.style.transform = `translate3d(${(now.x * l.depth).toFixed(2)}px, ${(now.y * l.depth * 0.7).toFixed(2)}px, 0)`;
      }
      const settled = Math.abs(target.x - now.x) < 0.002 && Math.abs(target.y - now.y) < 0.002;
      raf = settled ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = root.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      kick();
    };
    const leave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", leave);
    return () => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
      for (const l of layers) l.el.style.transform = "";
    };
  }, [stage, on]);
}
