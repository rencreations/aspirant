"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { mulberry32, smoothstep } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

const COLS = 24;
const ROWS = 7;
const AWAKE = ROWS * COLS - Math.floor(COLS * 2.5) - 7;

/** The Twilight Orb breaks into the Matrix; among the sleepers, one does not move. */
export default function OrbBreaks({ active, reduced }: SetPieceProps) {
  const broken = useRef(false);
  const [state, setState] = useState<"whole" | "broken">("whole");
  const brokeAt = useRef(-10);
  const cursor = useRef(Math.floor(COLS * 3.5));
  const showCursor = useRef(false);
  const [found, setFound] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();
  const shards = useMemo(() => {
    const r = mulberry32(24);
    return Array.from({ length: 70 }, () => ({
      a: r() * Math.PI * 2,
      v: 0.4 + r(),
      s: 2 + r() * 5,
      rot: r() * 6,
    }));
  }, []);
  const lattice = useMemo(() => {
    const r = mulberry32(7);
    return Array.from({ length: 60 }, () => [r(), r() * 0.75, r(), r() * 0.75] as const);
  }, []);

  const place = (i: number, w: number, h: number) => {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const depth = row / (ROWS - 1);
    const spread = 0.55 + depth * 0.4;
    const x = w / 2 + (col / (COLS - 1) - 0.5) * w * spread;
    const y = h * (0.92 - depth * 0.42);
    return { x, y, s: (1.2 - depth * 0.6) * Math.min(w, h) * 0.028 };
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, _dt: number, t: number) => {
    ctx.fillStyle = "#03030a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(200,200,255,${0.2 + ((i * 13) % 7) / 14})`;
      ctx.fillRect((((i * 97) % 100) / 100) * w, (((i * 61) % 100) / 100) * h, 1.2, 1.2);
    }
    const since = performance.now() / 1000 - brokeAt.current;
    const k = broken.current ? (reduced ? 1 : smoothstep(0, 1.6, since)) : 0;
    const cx = w / 2;
    const cy = h * 0.38;
    const R = Math.min(w, h) * 0.16;

    // The lattice of the Matrix settles out of the shards.
    if (k > 0) {
      ctx.strokeStyle = `rgba(200,212,235,${0.35 * k})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of lattice) {
        ctx.moveTo(x1 * w, y1 * h);
        ctx.lineTo(x2 * w, y2 * h);
      }
      ctx.stroke();
      // Rows of sleepers. An order pulse lifts them all, except one.
      const pulse = reduced ? 0 : Math.max(0, Math.sin(t * 1.4)) ** 6;
      for (let i = 0; i < ROWS * COLS; i++) {
        const p = place(i, w, h);
        const lift = i === AWAKE ? 0 : pulse * p.s * 0.6;
        ctx.fillStyle = `rgba(12,10,22,${k})`;
        ctx.fillRect(p.x - p.s * 0.35, p.y - p.s * 2 - lift, p.s * 0.7, p.s * 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y - p.s * 2.3 - lift, p.s * 0.32, 0, Math.PI * 2);
        ctx.fill();
        if (i !== AWAKE) {
          ctx.fillStyle = `rgba(150,110,255,${0.25 * k * (0.5 + pulse)})`;
          ctx.fillRect(p.x - p.s * 0.2, p.y - p.s * 2.35 - lift, p.s * 0.4, 1);
        } else {
          glow(ctx, p.x, p.y - p.s * 2.3, p.s * (found ? 4 : 1.6), "rgba(255,162,74,0.9)", k);
          ctx.fillStyle = `rgba(255,190,110,${k})`;
          ctx.fillRect(p.x - p.s * 0.2, p.y - p.s * 2.4, p.s * 0.12, p.s * 0.12);
          ctx.fillRect(p.x + p.s * 0.08, p.y - p.s * 2.4, p.s * 0.12, p.s * 0.12);
        }
        if (showCursor.current && cursor.current === i) {
          ctx.strokeStyle = "#5ce1ff";
          ctx.lineWidth = 2;
          ctx.strokeRect(p.x - p.s, p.y - p.s * 3.2, p.s * 2, p.s * 3.4);
        }
      }
      if (found) {
        ctx.font = `${Math.round(Math.min(w, h) * 0.07)}px "Instrument Serif", serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,228,190,0.92)";
        ctx.fillText("Why?", w / 2, h * 0.3);
        ctx.textAlign = "start";
      }
    }

    // The Orb, whole or flying apart.
    if (!broken.current || k < 1) {
      const alpha = 1 - k;
      glow(ctx, cx, cy, R * 3, "rgba(150,110,255,0.5)", alpha);
      if (!broken.current) {
        const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
        g.addColorStop(0, "#fff0d0");
        g.addColorStop(0.4, "#c8a0ff");
        g.addColorStop(1, "#2a1550");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (reduced ? 1 : 1 + Math.sin(t * 1.5) * 0.015), 0, Math.PI * 2);
        ctx.fill();
      } else if (!reduced) {
        for (const s of shards) {
          const d = R * (0.4 + since * s.v * 2.2);
          ctx.save();
          ctx.translate(cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d);
          ctx.rotate(s.rot + since * 2);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#d8c4ff";
          ctx.fillRect(-s.s, -s.s * 0.4, s.s * 2, s.s * 0.8);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);

  const breakOrb = () => {
    wake();
    if (!broken.current) {
      broken.current = true;
      brokeAt.current = performance.now() / 1000;
      setState("broken");
      note(196, { gain: 0.06, dur: 2.4 });
      note(293.66, { gain: 0.04, dur: 2.4, delay: 0.12 });
      announce("The Orb breaks. A lattice, and rows of sleepers. Find the one who does not move.");
    } else {
      broken.current = false;
      setFound(false);
      setState("whole");
      announce("The Orb is whole again.");
    }
    redraw();
  };

  const choose = (i: number) => {
    if (!broken.current) return;
    if (i === AWAKE) {
      setFound(true);
      note(440, { gain: 0.05, dur: 2 });
      announce("She does not move. Why?");
    } else {
      announce("This one is asleep.");
    }
    redraw();
  };

  const pick = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < ROWS * COLS; i++) {
      const p = place(i, r.width, r.height);
      const d = Math.hypot(p.x - x, p.y - p.s * 1.5 - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return bd < Math.min(r.width, r.height) * 0.05 ? best : -1;
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const move: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: COLS,
      ArrowDown: -COLS,
    };
    const m = move[e.key];
    if (m !== undefined && broken.current) {
      e.preventDefault();
      cursor.current = Math.max(0, Math.min(ROWS * COLS - 1, cursor.current + m));
      showCursor.current = true;
      redraw();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (broken.current && showCursor.current) choose(cursor.current);
      else breakOrb();
    } else if (e.key === "Escape" && broken.current) {
      breakOrb();
    }
  };

  return (
    <SetPieceFrame
      id="orb-breaks"
      code={state === "whole" ? "ORB" : found ? "WHY?" : "MATRIX"}
      accent="var(--violet)"
      footer={
        <>
          <button type="button" className={styles.button} onClick={breakOrb}>
            {state === "whole" ? "Break the Orb" : "Mend the Orb"}
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
        aria-roledescription="the Twilight Orb"
        aria-label="The Twilight Orb. Click or press Enter to break it. Then find the one sleeper who does not move: arrow keys and Enter, or tap."
        onPointerDown={(e) => {
          if (!broken.current) {
            breakOrb();
            return;
          }
          const i = pick(e);
          if (i >= 0) {
            cursor.current = i;
            choose(i);
          }
        }}
        onKeyDown={onKey}
        onBlur={() => {
          showCursor.current = false;
          redraw();
        }}
      />
    </SetPieceFrame>
  );
}
