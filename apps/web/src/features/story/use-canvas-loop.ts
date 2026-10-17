"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { useInView, usePageVisible, useReducedMotion } from "@/lib/hooks";

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void;

export interface CanvasLoop {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Ask for one more frame (used under reduced motion, where nothing animates on its own). */
  markDirty: () => void;
}

/**
 * A 2D canvas that fills its wrapper, with the site's rules built in: DPR capped at 1.75,
 * paused off screen and in hidden tabs, and under reduced motion it only draws when
 * `markDirty()` is called (on resize and on input). `draw` receives CSS pixels; the transform
 * is already scaled.
 */
export function useCanvasLoop(
  draw: Draw,
  { animate = true }: { animate?: boolean } = {},
): CanvasLoop {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(wrapRef, { rootMargin: "160px" });
  const visible = usePageVisible();
  const drawRef = useRef(draw);
  const dirty = useRef(true);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    drawRef.current = draw;
  });

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      size.current = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      dirty.current = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const running = inView && visible;
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { w, h, dpr } = size.current;
      if (w > 0 && (dirty.current || (animate && !reduced))) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        drawRef.current(g, w, h, reduced ? 0 : now / 1000, dt);
        dirty.current = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, animate, reduced]);

  return { wrapRef, canvasRef, markDirty };
}
