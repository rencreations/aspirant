"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { Meter } from "@/components/ui/meter";
import { clamp, smoothstep } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow, star4, useLive } from "./live";
import styles from "./setpieces.module.css";
import { hum, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

const SCORE = 1.62;
const BASE_HZ = 329.63;
const LOCK = 0.05;

type Hum = NonNullable<ReturnType<typeof hum>>;

/** The two Emblem stars: bring them together until they sing one note. */
export default function TwoStars({ active, reduced }: SetPieceProps) {
  const stars = useRef([
    { x: 0.28, y: 0.55 },
    { x: 0.74, y: 0.42 },
  ]);
  const selected = useRef(1);
  const focused = useRef(false);
  const glowK = useRef(0);
  const hums = useRef<Hum[]>([]);
  const [coupling, setCoupling] = useState(0);
  const couplingRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();

  const distance = () => {
    const [a, b] = stars.current;
    return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), ((a?.y ?? 0) - (b?.y ?? 0)) * 0.6);
  };

  const update = () => {
    const d = distance();
    const align = clamp(1 - (d - LOCK) / 0.5);
    const locked = d <= LOCK;
    const c = locked ? SCORE : Math.round(SCORE * smoothstep(0, 1, align) * 0.95 * 100) / 100;
    if (Math.abs(c - couplingRef.current) >= 0.01) {
      couplingRef.current = c;
      setCoupling(c);
      announce(locked ? "In sync. Coupling 1.62." : `Coupling ${c.toFixed(2)}.`);
    }
    const [h0, h1] = hums.current;
    if (h0 && h1) {
      h0.set(BASE_HZ, 0.028);
      h1.set(locked ? BASE_HZ : BASE_HZ * (1 + Math.min(0.08, d * 0.12)), 0.028);
    }
  };

  const startHums = () => {
    wake();
    if (hums.current.length) return;
    const a = hum(BASE_HZ, 0.028);
    const b = hum(BASE_HZ * 1.05, 0.028);
    if (a && b) hums.current = [a, b];
    update();
  };

  useEffect(() => {
    if (active) return;
    for (const h of hums.current) h.stop();
    hums.current = [];
  }, [active]);
  useEffect(
    () => () => {
      for (const h of hums.current) h.stop();
    },
    [],
  );

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#141a3a");
    sky.addColorStop(0.7, "#4a3456");
    sky.addColorStop(1, "#8a5a4a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // The east wing roof railing, green glass.
    ctx.fillStyle = "rgba(120,220,170,0.12)";
    ctx.fillRect(0, h * 0.86, w, h * 0.02);

    const d = distance();
    const locked = d <= LOCK;
    glowK.current = reduced ? (locked ? 1 : 0) : ease(glowK.current, locked ? 1 : 0, 3, dt);
    const s = Math.min(w, h);
    stars.current.forEach((p, i) => {
      const x = p.x * w;
      const y = p.y * h;
      const beat = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * (locked ? 2.4 : 2.4 + i * (d * 9)));
      const color = glowK.current > 0.5 ? "rgba(255,236,190,0.9)" : "rgba(255,210,110,0.85)";
      glow(ctx, x, y, s * (0.16 + glowK.current * 0.14), "rgba(255,215,120,0.45)", beat);
      ctx.fillStyle = color;
      star4(ctx, x, y, s * (0.07 + glowK.current * 0.03) * beat, 0.16);
      ctx.fill();
      // Long rays when they sing together.
      if (glowK.current > 0.05) {
        ctx.globalAlpha = glowK.current * 0.6;
        ctx.fillStyle = "#fff4d6";
        ctx.fillRect(x - s * 0.3, y - 0.75, s * 0.6, 1.5);
        ctx.fillRect(x - 0.75, y - s * 0.3, 1.5, s * 0.6);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#fff8e8";
      ctx.beginPath();
      ctx.arc(x, y, s * 0.008, 0, Math.PI * 2);
      ctx.fill();
      if (focused.current && selected.current === i) {
        ctx.strokeStyle = "#5ce1ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);

  const moveTo = (i: number, x: number, y: number) => {
    const p = stars.current[i];
    if (!p) return;
    p.x = clamp(x, 0.08, 0.92);
    p.y = clamp(y, 0.12, 0.82);
    update();
    redraw();
  };

  const drag = useRef(-1);
  const toLocal = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-0.02, 0],
      ArrowRight: [0.02, 0],
      ArrowUp: [0, -0.03],
      ArrowDown: [0, 0.03],
    };
    const m = step[e.key];
    if (m) {
      e.preventDefault();
      startHums();
      const p = stars.current[selected.current];
      if (p) moveTo(selected.current, p.x + m[0], p.y + m[1]);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      startHums();
      selected.current = 1 - selected.current;
      redraw();
    }
  };

  return (
    <SetPieceFrame
      id="two-stars"
      code={`SYNC ${coupling.toFixed(2)}`}
      accent="var(--gold)"
      footer={
        <>
          <div style={{ flex: "1 1 14rem" }}>
            <Meter
              label="Coupling"
              value={coupling}
              max={SCORE}
              format={(v) => v.toFixed(2)}
              showValue
              accent="var(--gold)"
            />
          </div>
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
        aria-roledescription="two stars"
        aria-label="Two Emblem stars. Drag one toward the other, or use the arrow keys; Space switches which star moves."
        onPointerDown={(e) => {
          startHums();
          const p = toLocal(e);
          const near = stars.current
            .map((s, i) => ({ i, d: Math.hypot(s.x - p.x, s.y - p.y) }))
            .sort((a, b) => a.d - b.d)[0];
          if (near && near.d < 0.2) {
            drag.current = near.i;
            selected.current = near.i;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (drag.current < 0) return;
          const p = toLocal(e);
          moveTo(drag.current, p.x, p.y);
        }}
        onPointerUp={() => {
          drag.current = -1;
        }}
        onKeyDown={onKey}
        onFocus={() => {
          focused.current = true;
          redraw();
        }}
        onBlur={() => {
          focused.current = false;
          redraw();
        }}
      />
    </SetPieceFrame>
  );
}
