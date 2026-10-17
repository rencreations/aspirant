"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A polite live-region message that updates at most once a second (the last message wins).
 * Render it as `<p aria-live="polite" className="sr-only">{message}</p>`.
 */
export function useLive(): [string, (message: string) => void] {
  const [message, setMessage] = useState("");
  const pending = useRef<string | null>(null);
  const last = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const announce = useCallback((next: string) => {
    pending.current = next;
    const wait = Math.max(0, 1000 - (performance.now() - last.current));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      last.current = performance.now();
      if (pending.current !== null) setMessage(pending.current);
    }, wait);
  }, []);
  return [message, announce];
}

/** Ease `current` toward `target` at rate `k` per second. */
export function ease(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-k * dt));
}

/** A soft radial glow at (x, y). */
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 1,
): void {
  if (r <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** A four-pointed star (the Emblem shape) centred at (x, y). */
export function star4(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  pinch = 0.18,
): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * pinch;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
