"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { clamp } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

const GOLD = "255,211,107";
const ROSE = "255,143,176";

/** Twin streams of light: steer two ribbons that twist round each other and rise. */
export default function TwinStreams({ active, reduced }: SetPieceProps) {
  const aim = useRef({ x: 0.5, y: 0.6 });
  const state = useRef({ x: 0.5, climb: 0.25, braid: 0, top: 0, auto: -1 });
  const chimed = useRef(false);
  const [risen, setRisen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    const s = state.current;
    if (s.auto >= 0) {
      s.auto += dt;
      aim.current = { x: 0.5, y: Math.max(0.02, 0.9 - s.auto * 0.25) };
      if (s.auto > 4.5) s.auto = -1;
    }
    const k = reduced ? 1 : 4;
    s.x = reduced ? aim.current.x : ease(s.x, aim.current.x, k, dt);
    const targetClimb = clamp(1 - aim.current.y);
    s.climb = reduced ? targetClimb : ease(s.climb, targetClimb, 2, dt);
    const centred = 1 - Math.min(1, Math.abs(s.x - 0.5) * 3);
    s.braid = reduced ? centred : ease(s.braid, centred, 2.5, dt);
    s.top =
      s.climb > 0.92 && s.braid > 0.7
        ? Math.min(1, s.top + dt * 0.8)
        : Math.max(0, s.top - dt * 0.3);
    if (s.top > 0.5 && !chimed.current) {
      chimed.current = true;
      setRisen(true);
      note(523.25, { gain: 0.045, dur: 2 });
      note(783.99, { gain: 0.035, dur: 2, delay: 0.12 });
      announce("They rise together, turn at the top of the sky, and come down softly, like snow.");
    }
    if (s.top < 0.05 && chimed.current && s.climb < 0.6) {
      chimed.current = false;
      setRisen(false);
    }

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#1e1c3a");
    sky.addColorStop(0.6, "#6a4a6a");
    sky.addColorStop(1, "#c9867a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // The silver net they climb through.
    ctx.strokeStyle = "rgba(214,221,232,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      ctx.moveTo((i / 16) * w, h * 0.08);
      ctx.lineTo((i / 16) * w + Math.sin(i) * 10, h * 0.45);
    }
    for (let j = 0; j < 6; j++) {
      const y = h * (0.08 + j * 0.075);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.33, y + 12, w * 0.66, y - 12, w, y);
    }
    ctx.stroke();

    // Two ribbons as a double helix rising from the road.
    const cx = s.x * w;
    const base = h * 0.95;
    const height = (0.25 + s.climb * 0.72) * h;
    const radius = (0.16 - s.braid * 0.11) * Math.min(w, h);
    ctx.globalCompositeOperation = "lighter";
    for (const [rgb, phase] of [
      [GOLD, 0],
      [ROSE, Math.PI],
    ] as const) {
      ctx.beginPath();
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const a = u * Math.PI * 7 + phase + (reduced ? 0 : t * 1.4);
        const x = cx + Math.cos(a) * radius * (1 - u * 0.4);
        const y = base - u * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb},0.85)`;
      ctx.lineWidth = 3 + s.braid * 2;
      ctx.shadowColor = `rgba(${rgb},0.9)`;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      glow(ctx, cx, base - height, 26 + s.braid * 20, `rgba(${rgb},0.7)`);
    }
    ctx.globalCompositeOperation = "source-over";

    // At the top they turn, and come down like snow.
    if (s.top > 0.01) {
      for (let i = 0; i < 70; i++) {
        const u = reduced ? (i * 0.137) % 1 : (t * 0.08 + i * 0.137) % 1;
        const x = cx + Math.sin(i * 12.9 + u * 6) * w * 0.3;
        const y = h * 0.05 + u * h * 0.9;
        ctx.fillStyle = i % 2 ? `rgba(${GOLD},${0.7 * s.top})` : `rgba(${ROSE},${0.7 * s.top})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);

  const steer = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    aim.current = {
      x: clamp((e.clientX - r.left) / r.width),
      y: clamp((e.clientY - r.top) / r.height),
    };
    if (reduced) redraw();
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-0.05, 0],
      ArrowRight: [0.05, 0],
      ArrowUp: [0, -0.08],
      ArrowDown: [0, 0.08],
    };
    const m = step[e.key];
    if (!m) return;
    e.preventDefault();
    wake();
    aim.current = { x: clamp(aim.current.x + m[0]), y: clamp(aim.current.y + m[1]) };
    redraw();
  };

  return (
    <SetPieceFrame
      id="twin-streams"
      code={risen ? "RISEN" : "STEER"}
      accent="var(--gold)"
      footer={
        <>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              wake();
              state.current.auto = 0;
              if (reduced) {
                aim.current = { x: 0.5, y: 0.02 };
                state.current.auto = -1;
                state.current.top = 1;
                redraw();
              }
            }}
          >
            Let them rise
          </button>
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
        role="application"
        aria-roledescription="ribbons"
        aria-label="Two ribbons of light, gold and rose. Move the pointer or drag, or use the arrow keys: left and right steer, up climbs. Centre them to braid."
        onPointerDown={(e) => {
          wake();
          e.currentTarget.setPointerCapture(e.pointerId);
          steer(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) steer(e);
        }}
        onKeyDown={onKey}
      />
    </SetPieceFrame>
  );
}
