"use client";

import { useEffect, type RefObject } from "react";

/**
 * A slight parallax with the pointer. The layers are the children of `root` that carry
 * `data-depth` (how far each moves, in pixels, when the pointer is at the edge; a negative number
 * moves against the pointer) and, optionally, `data-scale` (so a moving picture never shows its
 * edge). The pointer sets a target, a loop eases the layers to it with `transform` only, and the
 * loop stops when they have settled, so an idle page runs nothing.
 */
export function useParallax(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const layers = Array.from(el.querySelectorAll<HTMLElement>("[data-depth]")).map((node) => ({
      node,
      depth: Number(node.dataset.depth),
      scale: node.dataset.scale ? ` scale(${node.dataset.scale})` : "",
    }));
    const target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };
    let frame = 0;

    const apply = () => {
      for (const { node, depth, scale } of layers) {
        node.style.transform = `translate3d(${(now.x * depth).toFixed(2)}px, ${(now.y * depth).toFixed(2)}px, 0)${scale}`;
      }
    };
    const tick = () => {
      now.x += (target.x - now.x) * 0.1;
      now.y += (target.y - now.y) * 0.1;
      apply();
      frame =
        Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.002
          ? requestAnimationFrame(tick)
          : 0;
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      run();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      run();
    };
    apply();
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [root]);
}
