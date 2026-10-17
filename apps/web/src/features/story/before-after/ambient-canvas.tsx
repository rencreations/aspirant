"use client";

import { useEffect, type RefObject } from "react";

import { useCanvasLoop } from "../use-canvas-loop";
import { drawCalm, drawStorm, type CalmMode, type StormTone } from "./ambient-scenes";

export interface AmbientCanvasProps {
  /** Which world this canvas paints. */
  world: "calm" | "storm";
  mode: CalmMode;
  tone: StormTone;
  /** Track progress 0 to 1, written by the track (read every frame, never as state). */
  progress: RefObject<number>;
  className?: string;
}

/**
 * One of the two canvases behind a before and after track: the calm scene that drains as the
 * line is struck, or the storm that takes over. Paused off screen.
 */
export default function AmbientCanvas({
  world,
  mode,
  tone,
  progress,
  className,
}: AmbientCanvasProps) {
  const { wrapRef, canvasRef, markDirty } = useCanvasLoop((g, w, h, t) => {
    if (world === "calm") drawCalm(g, mode, w, h, t, progress.current);
    else drawStorm(g, tone, w, h, t);
  });

  // The track calls this whenever the progress moves (reduced motion draws only then).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const host = el.closest("[data-track]") ?? el;
    const on = () => markDirty();
    host.addEventListener("story:progress", on);
    return () => host.removeEventListener("story:progress", on);
  }, [wrapRef, markDirty]);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
