"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { clamp, smoothstep } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { hum, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

type Hum = NonNullable<ReturnType<typeof hum>>;
const LAMPS = 16;

function where(v: number): string {
  if (v < 0.05) return "At the start of the corridor";
  if (v < 0.5) return "Walking under the blue lamps";
  if (v < 0.8) return "The lamps are going out";
  if (v < 0.97) return "Near the black gate";
  return "At the black gate";
}

/** The long white corridor under the tower: walk it to the black gate. */
export default function Corridor({ active, reduced }: SetPieceProps) {
  const [walk, setWalk] = useState(0);
  const shown = useRef(0);
  const song = useRef<Hum | null>(null);
  const dragY = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();

  useEffect(() => {
    if (active) return;
    song.current?.stop();
    song.current = null;
  }, [active]);
  useEffect(() => () => song.current?.stop(), []);

  const go = (v: number) => {
    const next = clamp(v);
    setWalk(next);
    wake();
    song.current ??= hum(1320, 0.012);
    // A thin, sweet hum that rises as you go, and cuts out when the lights go out.
    const dark = smoothstep(0.62, 0.72, next);
    song.current?.set(1320 + next * 260, 0.018 * next * (1 - dark));
    announce(where(next));
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    shown.current = reduced ? walk : ease(shown.current, walk, 5, dt);
    const v = shown.current;
    const lightsOut = smoothstep(0.6, 0.78, v);
    const gate = smoothstep(0.66, 0.95, v);
    const cx = w / 2;
    const cy = h * 0.48;
    ctx.fillStyle = "#04060b";
    ctx.fillRect(0, 0, w, h);

    // Receding frames of the corridor: walls, ceiling, floor.
    const depth = 22;
    for (let i = depth; i >= 0; i--) {
      const z = i + 1 - ((v * 14) % 1);
      const s = 1 / (z * 0.35 + 0.35);
      const hw = w * 0.42 * s;
      const hh = h * 0.42 * s;
      const fog = Math.max(0, 1 - z / depth);
      const lit = (1 - lightsOut * 0.92) * fog;
      const c = Math.round(40 + 150 * lit);
      ctx.strokeStyle = `rgba(${c},${c + 8},${c + 22},${0.35 + 0.5 * fog})`;
      ctx.lineWidth = Math.max(0.5, 2 * s);
      ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
      // A cold blue lamp in the ceiling every frame or two.
      if (i % 2 === 0 && i < LAMPS) {
        const lx = cx;
        const ly = cy - hh + 4 * s;
        const on = (1 - lightsOut) * fog;
        const flick = reduced ? 1 : 0.9 + 0.1 * Math.sin(t * 13 + i);
        ctx.fillStyle = `rgba(111,182,255,${on})`;
        ctx.fillRect(lx - hw * 0.18, ly, hw * 0.36, Math.max(1, 3 * s));
        glow(ctx, lx, ly + 6 * s, hw * 0.6, "rgba(111,182,255,0.25)", on * flick);
      }
    }
    // A pale light spreads across the ceiling as the lamps die.
    glow(ctx, cx, h * 0.12, w * 0.5, "rgba(200,215,240,0.18)", lightsOut);

    // The black gate: a tear in the air, as tall as a door, with only dark behind it.
    if (gate > 0) {
      const gw = w * 0.05 * (0.4 + gate * 0.9);
      const gh = h * 0.2 * (0.4 + gate * 0.9);
      glow(ctx, cx, cy, gh * 1.4, "rgba(170,190,230,0.35)", gate);
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.moveTo(cx, cy - gh);
      ctx.lineTo(cx + gw, cy - gh * 0.2);
      ctx.lineTo(cx + gw * 0.7, cy + gh);
      ctx.lineTo(cx - gw * 0.8, cy + gh * 0.9);
      ctx.lineTo(cx - gw, cy - gh * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(210,225,255,${gate})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // A cold wind pours out toward you.
      if (!reduced) {
        ctx.fillStyle = `rgba(200,215,240,${0.4 * gate})`;
        for (let i = 0; i < 40; i++) {
          const u = (t * 0.4 + i / 40) % 1;
          const a = (i * 2.399) % (Math.PI * 2);
          const r = u * u * w * 0.6;
          ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 1 + u * 2, 1 + u * 2);
        }
      }
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);
  useEffect(() => {
    if (reduced) redraw();
  }, [walk, reduced, redraw]);

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const fwd = e.key === "ArrowUp" || e.key === "ArrowRight";
    const back = e.key === "ArrowDown" || e.key === "ArrowLeft";
    if (fwd || back) {
      e.preventDefault();
      go(walk + (fwd ? 0.04 : -0.04));
    } else if (e.key === "Home") go(0);
    else if (e.key === "End") go(1);
  };

  return (
    <SetPieceFrame
      id="corridor"
      code={where(walk).toUpperCase()}
      accent="var(--cyan)"
      footer={
        <>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: "1 1 auto" }}
          >
            <span>Walk</span>
            <input
              className={styles.range}
              type="range"
              min={0}
              max={100}
              value={Math.round(walk * 100)}
              aria-valuetext={where(walk)}
              onChange={(e) => go(Number(e.target.value) / 100)}
            />
          </label>
          <p aria-live="polite" className="sr-only">
            {message}
          </p>
        </>
      }
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        role="slider"
        aria-label="Walk the corridor"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(walk * 100)}
        aria-valuetext={where(walk)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragY.current = e.clientY + e.clientX;
          wake();
        }}
        onPointerMove={(e) => {
          if (dragY.current === null || !e.buttons) return;
          const now = e.clientY + e.clientX;
          go(walk + (dragY.current - now) * -0.002);
          dragY.current = now;
        }}
        onPointerUp={() => {
          dragY.current = null;
        }}
        onKeyDown={onKey}
      />
    </SetPieceFrame>
  );
}
