"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { audio } from "@/lib/audio";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, pentatonic, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

const N = 117;
const LINE = "A hundred and seventeen voices began to sing.";

/** A hundred and seventeen lighthouses on the far shore: light each one and hear its note. */
export default function Lighthouses({ active, reduced }: SetPieceProps) {
  const litAt = useRef(new Float32Array(N).fill(-1));
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const cursor = useRef({ i: 0, show: false });
  const wave = useRef(-1);
  const lastNote = useRef(0);
  const finishedAt = useRef(-1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();

  const sing = (i: number, sound: boolean) => {
    if (i < 0 || i >= N) return;
    const now = performance.now();
    if (sound && now - lastNote.current > 70) {
      lastNote.current = now;
      note(pentatonic(Math.floor((i / N) * 15), 220), { gain: 0.045, dur: 1.6 });
    }
    if (litAt.current[i]! >= 0) return;
    litAt.current[i] = now / 1000;
    countRef.current += 1;
    setCount(countRef.current);
    if (countRef.current === N) {
      finishedAt.current = now / 1000;
      announce(LINE);
    } else announce(`${countRef.current} of 117 lighthouses singing.`);
  };

  const pos = (i: number, w: number, h: number) => {
    const u = i / (N - 1);
    const x = w * (0.03 + u * 0.94);
    const y = h * (0.6 - Math.sin(u * Math.PI) * 0.05);
    return { x, y };
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, _dt: number) => {
    const t = performance.now() / 1000;
    if (wave.current >= 0) {
      const reach = reduced ? N : Math.floor((t - wave.current) * 16);
      for (let i = 0; i < Math.min(N, reach); i++) sing(i, !reduced && i === reach - 1);
      if (reach >= N) wave.current = -1;
    }
    // A calm dawn: pale sky, snow peaks far in the north, the harbour.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#1c2a4a");
    sky.addColorStop(0.45, "#6a7aa0");
    sky.addColorStop(0.62, "#f2c9a8");
    sky.addColorStop(1, "#22324a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(240,236,244,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    for (let i = 0; i <= 12; i++)
      ctx.lineTo((i / 12) * w, h * (0.5 - ((i * 7) % 5) * 0.035 - 0.04));
    ctx.lineTo(w, h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a4a66";
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    // Glitter on the water.
    glow(ctx, w * 0.7, h * 0.66, w * 0.3, "rgba(255,220,180,0.25)");

    for (let i = 0; i < N; i++) {
      const { x, y } = pos(i, w, h);
      const tall = h * (0.05 + ((i * 13) % 5) * 0.004);
      ctx.fillStyle = "#e9edf3";
      ctx.fillRect(x - 1.2, y - tall, 2.4, tall);
      const at = litAt.current[i]!;
      if (at >= 0) {
        const k = reduced ? 1 : Math.min(1, (t - at) * 3);
        const breathe = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 1.4 - i * 0.2);
        glow(ctx, x, y - tall, 9, "rgba(255,217,160,0.95)", k * breathe);
      } else {
        ctx.fillStyle = "rgba(120,130,150,0.8)";
        ctx.fillRect(x - 1, y - tall - 2, 2, 2);
      }
      if (cursor.current.show && cursor.current.i === i) {
        ctx.strokeStyle = "#5ce1ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 6, y - tall - 10, 12, tall + 14);
      }
    }

    if (finishedAt.current >= 0) {
      const k = reduced ? 1 : Math.min(1, (t - finishedAt.current) / 1.5);
      ctx.globalAlpha = k;
      ctx.font = `italic ${Math.round(Math.min(w, h) * 0.055)}px "Instrument Serif", serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff6ea";
      ctx.fillText(LINE, w / 2, h * 0.84, w * 0.92);
      ctx.textAlign = "start";
      ctx.globalAlpha = 1;
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);

  const nearest = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const u = ((e.clientX - r.left) / r.width - 0.03) / 0.94;
    return Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const c = cursor.current;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      c.i = Math.max(0, Math.min(N - 1, c.i + (e.key === "ArrowRight" ? 1 : -1)));
      c.show = true;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      wake();
      c.show = true;
      sing(c.i, true);
    }
    redraw();
  };

  return (
    <SetPieceFrame
      id="lighthouses"
      code={`SUNG ${String(count).padStart(3, "0")} / 117`}
      accent="var(--gold)"
      footer={
        <>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              wake();
              wave.current = reduced ? 0 : performance.now() / 1000;
              redraw();
            }}
          >
            Let them sing
          </button>
          <span className={styles.readout}>{count === N ? LINE : `${count} of 117`}</span>
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
        aria-roledescription="row of lighthouses"
        aria-label="A hundred and seventeen lighthouses. Hover, tap or drag across them to light each and hear its note; arrow keys move along the row and Enter plays one."
        onPointerDown={(e) => {
          wake();
          e.currentTarget.setPointerCapture(e.pointerId);
          sing(nearest(e), true);
          if (reduced) redraw();
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "mouse") {
            sing(nearest(e), audio.unlocked);
            if (reduced) redraw();
          }
        }}
        onKeyDown={onKey}
        onFocus={() => {
          cursor.current.show = true;
          redraw();
        }}
        onBlur={() => {
          cursor.current.show = false;
          redraw();
        }}
      />
    </SetPieceFrame>
  );
}
