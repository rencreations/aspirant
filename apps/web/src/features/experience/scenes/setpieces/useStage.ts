"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { usePageVisible } from "@/lib/hooks";

export interface StageSize {
  /** CSS pixels. */
  w: number;
  h: number;
  /** Device pixel ratio used for the backing store (capped at 2). */
  dpr: number;
}

/**
 * Drives a set-piece canvas: keeps the backing store at the element size times DPR (capped at
 * 2), calls `draw(ctx, size, dt, time)` every frame while `running` and the tab is visible,
 * and once whenever `redraw()` is called or the size changes. `draw` works in CSS pixels.
 */
export function useStage(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: (ctx: CanvasRenderingContext2D, size: StageSize, dt: number, time: number) => void,
  running: boolean,
): { redraw: () => void } {
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  const size = useRef<StageSize>({ w: 1, h: 1, dpr: 1 });
  const visible = usePageVisible();
  const start = useRef(typeof performance === "undefined" ? 0 : performance.now());

  const paint = useCallback(
    (dt: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const s = size.current;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      drawRef.current(ctx, s, dt, (performance.now() - start.current) / 1000);
    },
    [canvasRef],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      size.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      paint(0);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, paint]);

  useEffect(() => {
    if (!running || !visible) {
      paint(0);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      paint(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, visible, paint]);

  return { redraw: useCallback(() => paint(0), [paint]) };
}
