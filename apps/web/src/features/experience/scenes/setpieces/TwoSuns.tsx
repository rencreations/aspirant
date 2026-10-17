"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { clamp } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow } from "./live";
import styles from "./setpieces.module.css";
import { hum, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

type Hum = NonNullable<ReturnType<typeof hum>>;

const TOWERS = Array.from({ length: 22 }, (_, i) => ({
  x: i / 21,
  h: 0.18 + (((i * 53) % 17) / 17) * 0.32,
  w: 0.025 + ((i * 7) % 5) * 0.006,
}));

function label(v: number): string {
  if (v < 0.15) return "Lamp sun";
  if (v > 0.85) return "Real sun";
  return `${Math.round(v * 100)} percent real sun`;
}

/** Oro: the amber lamps of the Dome against the dull red real sun outside. */
export default function TwoSuns({ active, reduced }: SetPieceProps) {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  const buzz = useRef<Hum | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (active) return;
    buzz.current?.stop();
    buzz.current = null;
  }, [active]);
  useEffect(() => () => buzz.current?.stop(), []);

  const set = (v: number) => {
    const next = clamp(v);
    setValue(next);
    wake();
    buzz.current ??= hum(100, 0.02);
    buzz.current?.set(100, 0.02 * (1 - next));
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    shown.current = reduced ? value : ease(shown.current, value, 6, dt);
    const r = shown.current;
    const lamp = 1 - r;
    const horizon = h * 0.7;

    // Inside: warm amber under glass. Outside: thin brown air, wide and open.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(
      0,
      `rgb(${Math.round(40 + 6 * r)},${Math.round(26 + 4 * r)},${Math.round(14 + 8 * r)})`,
    );
    sky.addColorStop(
      1,
      `rgb(${Math.round(190 - 80 * r)},${Math.round(120 - 50 * r)},${Math.round(50 - 6 * r)})`,
    );
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // The real sun: low, dull red, rising from the edge of the world.
    glow(ctx, w * 0.62, horizon - h * 0.02, h * 0.5, "rgba(200,70,42,0.5)", r);
    ctx.globalAlpha = r;
    ctx.fillStyle = "#c8452a";
    ctx.beginPath();
    ctx.arc(w * 0.62, horizon - h * 0.02 - r * h * 0.04, h * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // The Dome: hexagon panes and a ring of amber lamps round the rim.
    if (lamp > 0.01) {
      const cx = w / 2;
      const R = Math.max(w, h) * 0.75;
      ctx.strokeStyle = `rgba(255,207,138,${0.28 * lamp})`;
      ctx.lineWidth = 1;
      const cell = Math.max(26, w / 26);
      for (let y = 0; y < horizon; y += cell * 0.87) {
        for (let x = (Math.round(y / (cell * 0.87)) % 2) * (cell / 2); x < w + cell; x += cell) {
          if (Math.hypot(x - cx, (y - horizon) * 1.4) > R) continue;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
            ctx.lineTo(x + Math.cos(a) * cell * 0.5, y + Math.sin(a) * cell * 0.5);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = Math.PI + (i / 17) * Math.PI;
        const x = cx + Math.cos(a) * w * 0.48;
        const y = horizon + Math.sin(a) * h * 0.62;
        const flick = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 3 + i);
        glow(ctx, x, y, h * 0.09, "rgba(255,179,71,0.85)", lamp * flick);
      }
      // Golden bars of false light on the streets.
      ctx.fillStyle = `rgba(255,200,110,${0.08 * lamp})`;
      for (let i = 0; i < 6; i++) ctx.fillRect(w * (0.1 + i * 0.15), 0, w * 0.04, horizon);
    }

    // Dorado's towers.
    for (const tw of TOWERS) {
      ctx.fillStyle = `rgb(${Math.round(30 - 10 * r)},${Math.round(20 - 8 * r)},${Math.round(14 - 6 * r)})`;
      ctx.fillRect(tw.x * w - tw.w * w * 0.5, horizon - tw.h * h, tw.w * w, tw.h * h);
      if (lamp > 0.05) {
        ctx.fillStyle = `rgba(255,208,138,${0.6 * lamp})`;
        for (let k = 0; k < 6; k++)
          ctx.fillRect(tw.x * w - 1, horizon - tw.h * h + k * h * 0.04 + 6, 2, 2);
      }
    }
    ctx.fillStyle = `rgb(${Math.round(24 + 30 * r)},${Math.round(16 + 14 * r)},10)`;
    ctx.fillRect(0, horizon, w, h - horizon);
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);
  useEffect(() => {
    if (reduced) redraw();
  }, [value, reduced, redraw]);

  const fromPointer = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    set((e.clientX - r.left) / r.width);
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 0.05
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -0.05
          : 0;
    if (step) {
      e.preventDefault();
      set(value + step);
    } else if (e.key === "Home") set(0);
    else if (e.key === "End") set(1);
  };

  return (
    <SetPieceFrame
      id="two-suns"
      code={value < 0.15 ? "LAMP" : value > 0.85 ? "REAL" : `MIX ${Math.round(value * 100)}`}
      accent="var(--amber)"
      footer={
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: "1 1 auto" }}>
          <span>Lamp sun</span>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={100}
            value={Math.round(value * 100)}
            aria-label="Lamp sun to real sun"
            aria-valuetext={label(value)}
            onChange={(e) => set(Number(e.target.value) / 100)}
          />
          <span>Real sun</span>
        </label>
      }
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        role="slider"
        aria-label="Lamp sun to real sun"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={label(value)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) fromPointer(e);
        }}
        onKeyDown={onKey}
      />
    </SetPieceFrame>
  );
}
