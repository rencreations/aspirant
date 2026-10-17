"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { clamp, mulberry32 } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, pentatonic, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

interface End {
  x: number;
  y: number;
}

/** Gantry Square: threads of light between Chang'e and Lesley; drag one, the other follows. */
export default function GantrySquare({ active, reduced }: SetPieceProps) {
  const ends = useRef<[End, End]>([
    { x: 0.22, y: 0.35 },
    { x: 0.8, y: 0.62 },
  ]);
  const lead = useRef(0);
  const target = useRef<End>({ x: 0.22, y: 0.35 });
  const focused = useRef(false);
  const squaredK = useRef(0);
  const closeFor = useRef(0);
  const [squared, setSquared] = useState(false);
  const [coupling, setCoupling] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();
  const threads = useMemo(() => {
    const r = mulberry32(21);
    return Array.from({ length: 34 }, () => ({
      ox: r() - 0.5,
      oy: r() - 0.5,
      sp: 0.2 + r() * 0.5,
      ph: r(),
    }));
  }, []);

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    const [a, b] = ends.current;
    const leader = lead.current === 0 ? a : b;
    const follower = lead.current === 0 ? b : a;
    leader.x = reduced ? target.current.x : ease(leader.x, target.current.x, 10, dt);
    leader.y = reduced ? target.current.y : ease(leader.y, target.current.y, 10, dt);
    // The other end follows on a soft spring, keeping a little distance.
    const fx = leader.x + (lead.current === 0 ? 0.12 : -0.12);
    const fy = leader.y + 0.05;
    const gap = Math.hypot(follower.x - fx, follower.y - fy);
    if (reduced) {
      follower.x = fx;
      follower.y = fy;
    } else {
      const k = gap > 0.02 ? 1.3 : 0;
      follower.x = ease(follower.x, fx, k, dt);
      follower.y = ease(follower.y, fy, k, dt);
    }

    const d = Math.hypot(a.x - b.x, (a.y - b.y) * 0.7);
    const c = clamp(1 - (d - 0.12) / 0.6);
    if (Math.abs(c - coupling) > 0.02) setCoupling(Math.round(c * 100) / 100);
    closeFor.current = d < 0.2 ? closeFor.current + dt : 0;
    const isSquared = reduced ? d < 0.2 : closeFor.current > 0.6;
    if (isSquared !== squared) {
      setSquared(isSquared);
      if (isSquared) {
        note(pentatonic(5, 330), { gain: 0.05, dur: 1.6 });
        note(pentatonic(7, 330), { gain: 0.04, dur: 1.6, delay: 0.08 });
        announce("Squared. One plus one is more than two.");
      }
    }
    squaredK.current = reduced
      ? isSquared
        ? 1
        : 0
      : ease(squaredK.current, isSquared ? 1 : 0, 3, dt);

    // Ruined rooftops at dusk.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#070a14");
    sky.addColorStop(1, "#1a2436");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#05070d";
    for (let i = 0; i < 14; i++) {
      const bw = w / 14;
      const bh = h * (0.12 + ((i * 37) % 11) / 60);
      ctx.fillRect(i * bw, h - bh, bw * 0.92, bh);
    }

    const ax = a.x * w;
    const ay = a.y * h;
    const bx = b.x * w;
    const by = b.y * h;
    const sq = squaredK.current;
    ctx.globalCompositeOperation = "lighter";
    for (const th of threads) {
      const spread = (1 - sq * 0.92) * Math.min(w, h) * 0.35;
      const cx = (ax + bx) / 2 + th.ox * spread;
      const cy = (ay + by) / 2 + th.oy * spread - spread * 0.2;
      ctx.strokeStyle = `rgba(127,232,255,${0.18 + sq * 0.2})`;
      ctx.lineWidth = 1 + sq;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();
      // A pearl of light travelling the thread.
      const u = reduced ? th.ph : (t * th.sp * (1 + sq * 2) + th.ph) % 1;
      const px = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx;
      const py = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by;
      glow(ctx, px, py, 6 + sq * 4, "rgba(255,244,210,0.9)");
    }
    ctx.globalCompositeOperation = "source-over";
    // Chang'e: pale green-white. Lesley: cyan.
    glow(ctx, ax, ay, 46, "rgba(220,255,240,0.8)");
    glow(ctx, bx, by, 40, "rgba(92,225,255,0.8)");
    for (const [x, y, i] of [
      [ax, ay, 0],
      [bx, by, 1],
    ] as const) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (focused.current && lead.current === i) {
        ctx.strokeStyle = "#ffcf5c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(220,240,255,0.7)";
    ctx.fillText("CHANG'E", ax + 14, ay - 12);
    ctx.fillText("LESLEY", bx + 14, by - 12);
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);

  const grab = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0.05, 0.95),
      y: clamp((e.clientY - r.top) / r.height, 0.08, 0.8),
    };
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-0.03, 0],
      ArrowRight: [0.03, 0],
      ArrowUp: [0, -0.04],
      ArrowDown: [0, 0.04],
    };
    const m = step[e.key];
    wake();
    if (m) {
      e.preventDefault();
      target.current = {
        x: clamp(target.current.x + m[0], 0.05, 0.95),
        y: clamp(target.current.y + m[1], 0.08, 0.8),
      };
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      lead.current = 1 - lead.current;
      const e2 = ends.current[lead.current];
      if (e2) target.current = { ...e2 };
    }
    redraw();
  };

  return (
    <SetPieceFrame
      id="gantry-square"
      code={squared ? "SQUARED" : `COUPLING ${coupling.toFixed(2)}`}
      accent="var(--cyan)"
      footer={
        <>
          <span className={styles.readout}>
            {squared
              ? "Squared: one plus one is more than two."
              : `Coupling ${coupling.toFixed(2)}`}
          </span>
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
        aria-roledescription="threads of light"
        aria-label="Two points joined by threads of light. Drag either end, or use the arrow keys; Space switches ends."
        onPointerDown={(e) => {
          wake();
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = grab(e);
          const [a, b] = ends.current;
          lead.current =
            Math.hypot(a.x - p.x, a.y - p.y) <= Math.hypot(b.x - p.x, b.y - p.y) ? 0 : 1;
          target.current = p;
        }}
        onPointerMove={(e) => {
          if (!e.buttons) return;
          target.current = grab(e);
          if (reduced) redraw();
        }}
        onKeyDown={onKey}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
        }}
      />
    </SetPieceFrame>
  );
}
