"use client";

import { useEffect, useRef } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { audio } from "@/lib/audio";
import { prefersReducedMotion, useVoiceState } from "@/lib/hooks";

export interface WaveformProps {
  /** Only draw while this voice line URL is playing. Omit to follow any voice line. */
  url?: string;
  /** Stroke colour. Default the theme accent. */
  color?: string;
  /** Number of bars. Default 48. */
  bars?: number;
  className?: string;
}

/**
 * Live waveform of the voice line that is playing (reads `audio.getAnalyser()`). Draws mirrored
 * bars on a canvas while its line plays and a flat, quiet baseline otherwise. Decorative
 * (aria-hidden): pair it with a labelled play button.
 *
 * <Waveform url={line.src} className="h-10 w-48" />
 */
export function Waveform({ url, color, bars = 48, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voice = useVoiceState();
  const active = voice.playing && (url === undefined || voice.url === url);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const stroke = color ?? getComputedStyle(canvas).color;
    let raf = 0;
    const data = new Uint8Array(512);
    const levels = new Float32Array(bars);

    const size = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    size();

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const analyser = audio.getAnalyser();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = stroke;
      const gap = w / bars;
      const bw = Math.max(1, gap * 0.45);
      if (active && analyser) {
        const n = Math.min(data.length, analyser.fftSize);
        analyser.getByteTimeDomainData(data.subarray(0, n));
        const step = Math.max(1, Math.floor(n / bars));
        for (let i = 0; i < bars; i++) {
          let peak = 0;
          for (let j = 0; j < step; j++) {
            const v = Math.abs((data[i * step + j] ?? 128) - 128) / 128;
            if (v > peak) peak = v;
          }
          const prev = levels[i] ?? 0;
          levels[i] = prev + (Math.min(1, peak * 2.2) - prev) * 0.35;
        }
      } else {
        for (let i = 0; i < bars; i++) levels[i] = (levels[i] ?? 0) * 0.85;
      }
      for (let i = 0; i < bars; i++) {
        const bh = Math.max(dpr, (levels[i] ?? 0) * h * 0.92);
        ctx.globalAlpha = active ? 0.95 : 0.45;
        ctx.fillRect(i * gap + (gap - bw) / 2, (h - bh) / 2, bw, bh);
      }
      const settled = !active && levels.every((v) => v < 0.002);
      raf = settled ? 0 : requestAnimationFrame(draw);
    };

    if (prefersReducedMotion() && !active) draw();
    else raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => {
      size();
      if (!raf) draw();
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active, bars, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("block h-10 w-full text-accent", className)}
    />
  );
}
