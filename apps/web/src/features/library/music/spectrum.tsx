"use client";

import { useEffect, useRef } from "react";

import { audio } from "@/lib/audio";

interface SpectrumProps {
  /** Draw live while true, then ease down to a flat line. */
  playing: boolean;
  bars?: number;
  className?: string;
}

/**
 * Frequency bars of the music that plays (the music analyser of the shared engine). One canvas,
 * drawn only while a track plays and for the short time the bars take to fall. The colour is the
 * CSS `color` of the canvas. Decorative: pair it with a labelled control.
 */
export function Spectrum({ playing, bars = 40, className }: SpectrumProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const color = getComputedStyle(canvas).color;
    const levels = new Float32Array(bars);
    const bins = new Uint8Array(512);
    let raf = 0;

    const size = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    size();

    const draw = () => {
      const analyser = audio.getMusicAnalyser();
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (playing && analyser) {
        analyser.getByteFrequencyData(bins);
        // The top of the spectrum is mostly empty for AAC, so only the lower part is drawn.
        const span = Math.floor(bins.length * 0.55);
        for (let i = 0; i < bars; i++) {
          const from = Math.floor((i / bars) ** 1.5 * span);
          const to = Math.max(from + 1, Math.floor(((i + 1) / bars) ** 1.5 * span));
          let peak = 0;
          for (let j = from; j < to; j++) peak = Math.max(peak, bins[j] ?? 0);
          const prev = levels[i] ?? 0;
          levels[i] = prev + (peak / 255 - prev) * 0.4;
        }
      } else {
        for (let i = 0; i < bars; i++) levels[i] = (levels[i] ?? 0) * 0.86;
      }
      const gap = w / bars;
      const bw = Math.max(1, gap * 0.56);
      ctx.fillStyle = color;
      for (let i = 0; i < bars; i++) {
        const bh = Math.max(dpr * 1.5, (levels[i] ?? 0) * h);
        ctx.globalAlpha = 0.4 + (levels[i] ?? 0) * 0.6;
        ctx.fillRect(i * gap + (gap - bw) / 2, h - bh, bw, bh);
      }
      const settled = !playing && levels.every((v) => v < 0.01);
      raf = settled ? 0 : requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => {
      size();
      if (!raf) draw();
    });
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [playing, bars]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
