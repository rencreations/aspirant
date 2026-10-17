"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { mulberry32 } from "@/lib/math";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, pentatonic, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

const TOTAL = 1000;
const COLS = 50;

interface Grid {
  /** Window rows per column (sums to 1000). */
  heights: number[];
  /** First window index of each column. */
  offsets: number[];
}

function buildGrid(): Grid {
  const rand = mulberry32(38);
  const heights: number[] = [];
  let c = 0;
  while (c < COLS) {
    const span = 2 + Math.floor(rand() * 3);
    const h = 10 + Math.floor(rand() * 18);
    for (let k = 0; k < span && c < COLS; k++, c++) heights.push(h);
  }
  // Nudge the heights until there are exactly a thousand windows.
  let sum = heights.reduce((a, b) => a + b, 0);
  let i = 0;
  while (sum !== TOTAL) {
    const j = i % COLS;
    const step = sum < TOTAL ? 1 : -1;
    const next = (heights[j] ?? 10) + step;
    if (next >= 6 && next <= 30) {
      heights[j] = next;
      sum += step;
    }
    i += 7;
  }
  const offsets: number[] = [];
  let acc = 0;
  for (const h of heights) {
    offsets.push(acc);
    acc += h;
  }
  return { heights, offsets };
}

/** Tanner's Row at dusk: light the thousand little windows. */
export default function LittleLights({ active, reduced }: SetPieceProps) {
  const grid = useMemo(buildGrid, []);
  const litAt = useRef(new Float32Array(TOTAL).fill(-1));
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const cursor = useRef({ col: 24, row: 4, show: false });
  const wave = useRef(-1);
  const beam = useRef(0);
  const lastNote = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useRef({ x0: 0, cw: 1, wh: 1, base: 1 });
  const [message, announce] = useLive();

  const lightIndex = (i: number, sound: boolean, time: number) => {
    if (i < 0 || i >= TOTAL || litAt.current[i]! >= 0) return;
    litAt.current[i] = time;
    countRef.current += 1;
    setCount(countRef.current);
    if (sound && performance.now() - lastNote.current > 80) {
      lastNote.current = performance.now();
      note(pentatonic((i * 7) % 15, 392), { gain: 0.04, dur: 0.9 });
    }
    if (countRef.current === TOTAL) announce("All the little lights.");
    else announce(`${countRef.current} of 1000 windows lit.`);
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number) => {
    const t = performance.now() / 1000;
    // Dusk over the lower terraces.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0b1030");
    sky.addColorStop(0.55, "#3a2a55");
    sky.addColorStop(0.8, "#b8664a");
    sky.addColorStop(1, "#2a1622");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.7, h * 0.78, w * 0.45, "rgba(255,150,90,0.35)");

    const cw = w / (COLS + 2);
    const x0 = cw;
    const wh = Math.min(h * 0.024, cw * 0.9);
    const base = h * 0.98;
    layout.current = { x0, cw, wh, base };

    if (wave.current >= 0) {
      const reached = reduced ? COLS : Math.floor((t - wave.current) * 22);
      for (let c = 0; c < Math.min(COLS, reached); c++) {
        const off = grid.offsets[c] ?? 0;
        for (let r = 0; r < (grid.heights[c] ?? 0); r++) lightIndex(off + r, false, t);
      }
      if (reached >= COLS) wave.current = -1;
    }

    for (let c = 0; c < COLS; c++) {
      const rows = grid.heights[c] ?? 0;
      const x = x0 + c * cw;
      const top = base - rows * wh * 1.55 - wh;
      ctx.fillStyle = "#0a0a14";
      ctx.fillRect(x - cw * 0.08, top, cw * 1.16, base - top + 2);
      const off = grid.offsets[c] ?? 0;
      for (let r = 0; r < rows; r++) {
        const i = off + r;
        const y = base - (r + 1) * wh * 1.55;
        const at = litAt.current[i]!;
        let k = 0;
        if (at >= 0) {
          k = reduced ? 1 : Math.min(1, (t - at) * 2.5);
          if (!reduced) k *= 0.82 + 0.18 * Math.sin(t * (1.1 + (i % 7) * 0.3) + i);
        }
        ctx.fillStyle =
          k > 0 ? `rgba(255, ${190 + (i % 5) * 8}, 120, ${0.25 + k * 0.75})` : "#1b1a28";
        ctx.fillRect(x + cw * 0.2, y, cw * 0.6, wh);
        if (k > 0.2 && i % 3 === 0)
          glow(ctx, x + cw * 0.5, y + wh / 2, wh * 2.6, "rgba(255,190,110,0.35)", k);
      }
    }

    // Every window lit: the green beam of the Trial rises over the terraces.
    if (countRef.current === TOTAL) {
      beam.current = reduced ? 1 : Math.min(1, beam.current + dt * 0.4);
      const bx = x0 + (COLS / 2) * cw;
      const bh = h * beam.current;
      const g = ctx.createLinearGradient(bx - cw * 2, 0, bx + cw * 2, 0);
      g.addColorStop(0, "rgba(90,255,170,0)");
      g.addColorStop(0.5, "rgba(170,255,210,0.85)");
      g.addColorStop(1, "rgba(90,255,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(bx - cw * 2, base - bh, cw * 4, bh);
      glow(ctx, bx, base - bh, cw * 8, "rgba(120,255,190,0.5)", beam.current);
    }

    if (cursor.current.show) {
      const { col, row } = cursor.current;
      const x = x0 + col * cw;
      const y = base - (row + 1) * wh * 1.55;
      ctx.strokeStyle = "#5ce1ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + cw * 0.05, y - wh * 0.3, cw * 0.9, wh * 1.6);
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);

  const hit = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x0, cw, wh, base } = layout.current;
    const c = Math.floor((e.clientX - rect.left - x0) / cw);
    if (c < 0 || c >= COLS) return;
    const r = Math.floor((base - (e.clientY - rect.top)) / (wh * 1.55));
    if (r < 0 || r >= (grid.heights[c] ?? 0)) return;
    lightIndex((grid.offsets[c] ?? 0) + r, true, performance.now() / 1000);
    if (reduced) redraw();
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const cur = cursor.current;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const m = move[e.key];
    if (m) {
      e.preventDefault();
      cur.col = Math.max(0, Math.min(COLS - 1, cur.col + m[0]));
      cur.row = Math.max(0, Math.min((grid.heights[cur.col] ?? 1) - 1, cur.row + m[1]));
      cur.show = true;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      wake();
      cur.show = true;
      lightIndex((grid.offsets[cur.col] ?? 0) + cur.row, true, performance.now() / 1000);
    }
    redraw();
  };

  return (
    <SetPieceFrame
      id="little-lights"
      code={`LIT ${String(count).padStart(4, "0")} / 1000`}
      accent="var(--gold)"
      footer={
        <>
          <button
            type="button"
            className={styles.button}
            disabled={count === TOTAL}
            onClick={() => {
              wake();
              note(pentatonic(0, 392), { gain: 0.05 });
              wave.current = performance.now() / 1000;
              if (reduced) {
                wave.current = 0;
                redraw();
              }
            }}
          >
            Light the row
          </button>
          <span className={styles.readout}>
            {count === TOTAL ? "All the little lights." : `${count} of 1000`}
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
        aria-roledescription="window grid"
        aria-label="A thousand windows in Tanner's Row. Light them with a click, a tap, a drag, or arrow keys and Enter."
        onPointerDown={(e) => {
          wake();
          e.currentTarget.setPointerCapture(e.pointerId);
          hit(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons) hit(e);
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
