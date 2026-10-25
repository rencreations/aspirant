"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

/** Mostly dark, so the white nav text stays readable on any square. */
const PALETTE = [
  "#0a0614",
  "#140e26",
  "#140e26",
  "#1c1436",
  "#241a40",
  "#241a40",
  "#4a2d99",
  "#7a4fd6",
  "#b0287f",
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The livestream to the game. The stream draws back and a mosaic of big squares grows over it in a
 * random order, until the whole screen is pixels. The page jumps to the game under the mosaic,
 * and the squares go out again in a different random order. One canvas, drawn only while it plays.
 */
export const PixelScene = forwardRef<SceneHandle>(function PixelScene(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(
    ref,
    (): SceneHandle => ({
      build(ctx) {
        const c = canvas.current;
        const g = c?.getContext("2d");
        if (!c || !g) return;
        const k = ctx.level === "lite" ? 0.7 : 1;
        const cols = ctx.level === "full" ? 28 : ctx.level === "balanced" ? 18 : 12;
        const cell = Math.ceil(ctx.vw / cols);
        const rows = Math.ceil(ctx.vh / cell);
        c.width = cols * cell;
        c.height = rows * cell;
        c.style.width = `${String(cols * cell)}px`;
        c.style.height = `${String(rows * cell)}px`;
        const n = cols * rows;
        const inDelay = new Float32Array(n);
        const outDelay = new Float32Array(n);
        const colour: string[] = [];
        for (let i = 0; i < n; i++) {
          inDelay[i] = Math.random();
          outDelay[i] = Math.random();
          colour.push(PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? "#140e26");
        }
        const state = { cover: 0, reveal: 0 };
        const draw = () => {
          g.clearRect(0, 0, c.width, c.height);
          for (let i = 0; i < n; i++) {
            const v =
              state.reveal > 0
                ? 1 - clamp01((state.reveal - (outDelay[i] ?? 0) * 0.72) / 0.28)
                : clamp01((state.cover - (inDelay[i] ?? 0) * 0.72) / 0.28);
            if (v <= 0) continue;
            const x = (i % cols) * cell;
            const y = Math.floor(i / cols) * cell;
            g.fillStyle = colour[i] ?? "#140e26";
            if (v >= 1) {
              g.fillRect(x, y, cell + 1, cell + 1);
            } else {
              const s = cell * (0.25 + 0.75 * v);
              g.fillRect(x + (cell - s) / 2, y + (cell - s) / 2, s, s);
            }
          }
        };
        draw();
        if (ctx.held) {
          ctx.tl.set(ctx.held, { transformOrigin: ctx.pivot() }, 0);
          ctx.tl.to(ctx.held, { scale: 0.95, duration: 0.62 * k, ease: "power2.in" }, 0);
        }
        ctx.tl.to(state, { cover: 1, duration: 0.62 * k, ease: "none", onUpdate: draw }, 0);
        ctx.hint(0.5 * k, "dark");
        ctx.swapAt(0.66 * k);
        ctx.tl.to(state, { reveal: 1, duration: 0.7 * k, ease: "none", onUpdate: draw }, 0.7 * k);
      },
      reset() {
        const c = canvas.current;
        c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      },
    }),
    [],
  );

  return <canvas ref={canvas} className={styles.pixel} />;
});
