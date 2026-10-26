"use client";

import { useEffect, useRef } from "react";

interface Options {
  reduced: boolean;
  /** Pressing and holding floods the picture (Angela's warmth); a press only pulses it otherwise. */
  flood: boolean;
}

const ease = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * The circle that shows the second picture of the hero. It follows the pointer (or a finger),
 * wanders by itself when nobody is there, swells while the pointer is pressed, and only runs while
 * the hero is on screen and the tab is visible. One loop writes three custom properties on one
 * element and one transform on another; nothing on the page root is touched. Reduced motion keeps
 * a still circle that follows the pointer without easing.
 */
export function useHeroPointer({ reduced, flood }: Options) {
  /** The pointer is read on the stage. The second picture gets `--mx`, `--my` and `--r` (px), which its mask reads. */
  const host = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLImageElement>(null);
  /** An element that follows the circle (a crosshair, a halo). Moved with a transform only. */
  const mark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hostEl = host.current;
    const layerEl = layer.current;
    if (!hostEl || !layerEl) return;
    const markEl = mark.current;

    const weak = document.documentElement.dataset.perf === "balanced";
    let rect = hostEl.getBoundingClientRect();
    const cur = { x: rect.width * 0.5, y: rect.height * 0.45, r: 0 };
    const goal = { x: cur.x, y: cur.y, r: 0 };
    let lastMove = -1e9;
    let pressedAt = -1;
    let visible = false;
    let raf = 0;
    const t0 = performance.now();

    const base = () => Math.max(120, Math.min(rect.width, rect.height) * 0.24);

    const write = () => {
      layerEl.style.setProperty("--mx", `${cur.x.toFixed(1)}px`);
      layerEl.style.setProperty("--my", `${cur.y.toFixed(1)}px`);
      layerEl.style.setProperty("--r", `${Math.max(0, cur.r).toFixed(1)}px`);
      if (markEl)
        markEl.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0)`;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const idle = now - lastMove > 2600;
      const t = (now - t0) / 1000;
      if (idle && !reduced && !weak) {
        // Nobody there: the circle drifts over the picture on a slow loop.
        goal.x = rect.width * (0.5 + 0.26 * Math.sin(t * 0.55));
        goal.y = rect.height * (0.46 + 0.18 * Math.sin(t * 0.83 + 1.1));
        goal.r = base() * (0.8 + 0.2 * Math.sin(t * 1.3));
      } else if (idle) {
        goal.r = base() * 0.7;
      }
      if (pressedAt >= 0) {
        const held = (now - pressedAt) / 1000;
        goal.r = flood
          ? Math.min(Math.hypot(rect.width, rect.height), base() * (1 + held * 2.6))
          : base() * 1.35;
      }
      const k = reduced ? 1 : 0.14;
      cur.x = ease(cur.x, goal.x, k);
      cur.y = ease(cur.y, goal.y, k);
      cur.r = ease(cur.r, goal.r, reduced ? 1 : flood && pressedAt >= 0 ? 0.08 : 0.12);
      write();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const move = (e: PointerEvent) => {
      rect = hostEl.getBoundingClientRect();
      goal.x = e.clientX - rect.left;
      goal.y = e.clientY - rect.top;
      goal.r = base();
      lastMove = performance.now();
      start();
    };
    const down = (e: PointerEvent) => {
      move(e);
      pressedAt = performance.now();
    };
    const up = () => {
      pressedAt = -1;
      goal.r = base();
    };
    const leave = () => {
      lastMove = performance.now() - 2000;
    };
    const resize = () => {
      rect = hostEl.getBoundingClientRect();
    };

    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const entry = entries[entries.length - 1];
        visible = entry?.isIntersecting ?? false;
        if (visible) {
          rect = hostEl.getBoundingClientRect();
          start();
        }
      },
      { threshold: 0.05 },
    );
    io.observe(hostEl);

    hostEl.addEventListener("pointermove", move, { passive: true });
    hostEl.addEventListener("pointerdown", down, { passive: true });
    hostEl.addEventListener("pointerleave", leave, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", up, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", start);
    write();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      hostEl.removeEventListener("pointermove", move);
      hostEl.removeEventListener("pointerdown", down);
      hostEl.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", start);
    };
  }, [reduced, flood]);
  return { host, layer, mark };
}
