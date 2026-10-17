"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { mulberry32, smoothstep } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { hum, note, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

type Hum = NonNullable<ReturnType<typeof hum>>;

/**
 * Press and hold: the sky breaks and everything falls silent; let go and it comes back.
 * c12: Valemont, 978, lanterns on the lake. c18: the Base by the harbour, a lamp on the third floor.
 */
export default function SkyBreak({ active, reduced, chapterId }: SetPieceProps) {
  const base = chapterId === "c18";
  const id = base ? "base-falls" : "sky-breaks-978";
  const holding = useRef(false);
  const [held, setHeld] = useState(false);
  const k = useRef(0);
  const drone = useRef<Hum | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();
  const sparks = useMemo(() => {
    const r = mulberry32(978);
    return Array.from({ length: 90 }, () => ({ x: r(), s: r(), v: 0.3 + r() * 0.7 }));
  }, []);
  const crack = useMemo(() => {
    const r = mulberry32(9);
    const pts: Array<[number, number]> = [];
    let y = 0.18;
    for (let i = 0; i <= 14; i++) {
      pts.push([i / 14, y]);
      y += (r() - 0.5) * 0.09;
    }
    return pts;
  }, []);

  const stopDrone = () => {
    drone.current?.stop();
    drone.current = null;
  };
  useEffect(() => {
    if (!active) stopDrone();
  }, [active]);
  useEffect(() => stopDrone, []);

  const press = () => {
    if (holding.current) return;
    wake();
    holding.current = true;
    setHeld(true);
    drone.current ??= hum(base ? 55 : 49, 0.04);
    announce(base ? "Holding. The street goes white and silent." : "Holding. The sky breaks.");
  };
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    setHeld(false);
    stopDrone();
    note(base ? 523.25 : 392, { gain: 0.05, dur: 1.8 });
    announce(base ? "Let go. The lamp in the window is back." : "Let go. The evening comes back.");
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    // Hold builds over about 3.5 s; release eases back over about 2 s.
    k.current = holding.current
      ? Math.min(1, k.current + dt / 3.5)
      : Math.max(0, k.current - dt / 2);
    const p = k.current;
    const breakK = smoothstep(0, 0.6, p);
    const silence = smoothstep(0.6, 1, p);
    drone.current?.set(base ? 55 + p * 20 : 49 + p * 30, 0.04 * (1 - silence));

    // Evening sky, deepening to violet as it breaks.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (base) {
      sky.addColorStop(0, mix("#1a1430", "#2a0f3a", breakK));
      sky.addColorStop(0.7, mix("#6a3a5a", "#7a2a8a", breakK));
      sky.addColorStop(1, mix("#ff9a6a", "#ff6ac8", breakK));
    } else {
      sky.addColorStop(0, mix("#141a3a", "#0a0618", breakK));
      sky.addColorStop(0.7, mix("#6a4a7a", "#3a1a7a", breakK));
      sky.addColorStop(1, mix("#e89a6a", "#7a4dff", breakK));
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const horizon = h * 0.62;
    if (base) {
      // Harbour, the Base tower, the third-floor window.
      ctx.fillStyle = "#0c0a14";
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.fillStyle = "#08070e";
      ctx.fillRect(w * 0.62, h * 0.18, w * 0.12, horizon - h * 0.18);
      ctx.fillRect(w * 0.1, h * 0.42, w * 0.3, horizon - h * 0.42);
      const lamp = 1 - smoothstep(0.3, 0.7, p);
      const wx = w * 0.665;
      const wy = h * 0.46;
      ctx.fillStyle = `rgba(255,205,140,${0.15 + lamp * 0.85})`;
      ctx.fillRect(wx, wy, w * 0.03, h * 0.045);
      glow(ctx, wx + w * 0.015, wy + h * 0.02, w * 0.08, "rgba(255,190,120,0.5)", lamp);
      // A pink-violet light grows far down the street.
      glow(
        ctx,
        w * 0.25,
        horizon - h * 0.04,
        w * 0.25 * breakK + 1,
        "rgba(255,120,220,0.7)",
        breakK,
      );
    } else {
      // Valemont: green hills, a lake, First Light lanterns on the water.
      ctx.fillStyle = "#0e1420";
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let x = 0; x <= w; x += w / 24)
        ctx.lineTo(x, horizon - Math.sin((x / w) * 7) * h * 0.05 - h * 0.03);
      ctx.lineTo(w, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0a0f1e";
      ctx.fillRect(0, horizon, w, h - horizon);
      const lanterns = 1 - smoothstep(0.2, 0.6, p);
      for (let i = 0; i < 46; i++) {
        const lx = ((i * 0.618) % 1) * w;
        const depth = (i % 9) / 9;
        const ly = horizon + h * 0.04 + depth * (h - horizon) * 0.85;
        const bob = reduced ? 0 : Math.sin(t * 1.2 + i) * 1.5;
        glow(ctx, lx, ly + bob, 4 + depth * 12, "rgba(255,170,90,0.9)", lanterns);
      }
    }

    // The tear across the sky.
    if (breakK > 0.01) {
      ctx.strokeStyle = `rgba(200,170,255,${breakK})`;
      ctx.lineWidth = 1 + breakK * 5;
      ctx.shadowColor = "#b59cff";
      ctx.shadowBlur = 18 * breakK;
      ctx.beginPath();
      crack.forEach(([x, y], i) => {
        const yy = (y + (i % 2 ? 1 : -1) * breakK * 0.02) * h;
        if (i === 0) ctx.moveTo(x * w, yy);
        else ctx.lineTo(x * w, yy);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!reduced) {
        ctx.fillStyle = `rgba(230,210,255,${breakK * 0.9})`;
        for (const s of sparks) {
          const fall = (t * s.v * 0.25 + s.s) % 1;
          ctx.fillRect(s.x * w, h * (0.2 + fall * 0.6), 1.2, 6);
        }
      }
    }

    // Silence: everything drains to grey (c12) or white (c18). A slow fade, never a flash.
    if (silence > 0) {
      ctx.fillStyle = base ? `rgba(240,238,234,${silence})` : `rgba(58,60,68,${silence})`;
      ctx.fillRect(0, 0, w, h);
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && (held || !reduced));

  useEffect(() => {
    if (!reduced) return;
    // Reduced motion: no animation loop; step the crossfade a few times on change.
    let n = 0;
    const id2 = window.setInterval(() => {
      redraw();
      if (++n > 40) window.clearInterval(id2);
    }, 100);
    return () => window.clearInterval(id2);
  }, [held, reduced, redraw]);

  return (
    <SetPieceFrame
      id={id}
      code={held ? "HOLDING" : "HOLD"}
      accent={base ? "var(--magenta)" : "var(--violet)"}
      footer={
        <>
          <span className={styles.readout}>
            {held ? "Holding on." : "Press and hold the picture."}
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
        role="button"
        aria-pressed={held}
        aria-label={
          base
            ? "The Base by the harbour. Press and hold to let it fall to white silence; let go to bring the lamp back."
            : "Valemont in 978. Press and hold to let the sky break; let go to bring the evening back."
        }
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onBlur={release}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!e.repeat) press();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") release();
        }}
      />
    </SetPieceFrame>
  );
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
