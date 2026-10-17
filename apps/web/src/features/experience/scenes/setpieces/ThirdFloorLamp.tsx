"use client";

import { useEffect, useRef, useState } from "react";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

/** The Academy tower at night, and an ordinary lamp in the third-floor window. */
export default function ThirdFloorLamp({ active, reduced }: SetPieceProps) {
  const [on, setOn] = useState(false);
  const k = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, announce] = useLive();

  const toggle = () => {
    wake();
    const next = !on;
    setOn(next);
    announce(next ? "The lamp is on." : "The lamp is off.");
    if (next) {
      note(659.25, { gain: 0.04, dur: 1.6 });
      note(987.77, { gain: 0.02, dur: 1.4, delay: 0.1 });
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    k.current = reduced ? (on ? 1 : 0) : ease(k.current, on ? 1 : 0, 2.5, dt);
    const lamp = k.current;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#04060e");
    sky.addColorStop(0.75, "#141c34");
    sky.addColorStop(1, "#1e2440");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const tw = reduced ? 0.6 : 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i * 1.7));
      ctx.fillStyle = `rgba(210,220,255,${0.25 * tw})`;
      ctx.fillRect((((i * 113) % 100) / 100) * w, (((i * 37) % 60) / 100) * h, 1.3, 1.3);
    }
    // The city's soft lights along the bottom.
    const ground = h * 0.86;
    ctx.fillStyle = "#070a14";
    ctx.fillRect(0, ground, w, h - ground);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = "rgba(255,200,140,0.35)";
      ctx.fillRect(
        (((i * 71) % 100) / 100) * w,
        ground + 6 + (((i * 13) % 20) / 20) * (h - ground - 12),
        2,
        2,
      );
    }

    // The tower: slender glass, a crystal lantern at the top.
    const tx = w * 0.5;
    const tw2 = Math.max(26, w * 0.07);
    const top = h * 0.12;
    ctx.fillStyle = "#0d1426";
    ctx.fillRect(tx - tw2 / 2, top, tw2, ground - top);
    ctx.strokeStyle = "rgba(150,190,230,0.25)";
    ctx.strokeRect(tx - tw2 / 2, top, tw2, ground - top);
    glow(
      ctx,
      tx,
      top - 6,
      tw2 * 1.6,
      "rgba(127,255,190,0.6)",
      reduced ? 1 : 0.85 + 0.15 * Math.sin(t),
    );
    ctx.fillStyle = "#bff3ff";
    ctx.fillRect(tx - 3, top - 10, 6, 8);

    // Floors; the third from the bottom is the one with the lamp.
    const floors = 12;
    const fh = (ground - top) / floors;
    for (let f = 0; f < floors; f++) {
      const y = ground - (f + 1) * fh + fh * 0.3;
      const isThird = f === 2;
      ctx.fillStyle = isThird ? `rgba(255,205,140,${0.08 + lamp * 0.92})` : "rgba(40,55,90,0.6)";
      ctx.fillRect(tx - tw2 * 0.28, y, tw2 * 0.56, fh * 0.45);
      if (isThird && lamp > 0.01) {
        glow(ctx, tx, y + fh * 0.2, tw2 * 4, "rgba(255,190,120,0.55)", lamp);
        // A thin path of light toward the horizon.
        const g = ctx.createLinearGradient(tx, y, w, ground);
        g.addColorStop(0, `rgba(255,205,140,${0.35 * lamp})`);
        g.addColorStop(1, "rgba(255,205,140,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx + tw2 * 0.3, y + fh * 0.2);
        ctx.quadraticCurveTo(w * 0.75, y + fh, w * 0.98, ground - 4);
        ctx.stroke();
      }
    }
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);
  useEffect(() => {
    redraw();
  }, [on, redraw]);

  return (
    <SetPieceFrame
      id="third-floor-lamp"
      code={on ? "LAMP ON" : "LAMP OFF"}
      accent="var(--gold)"
      aspect="4 / 3"
      footer={
        <>
          <button type="button" className={styles.button} aria-pressed={on} onClick={toggle}>
            {on ? "Lamp on" : "Lamp off"}
          </button>
          <span className={styles.readout}>{on ? "The lamp is on." : "The window is dark."}</span>
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
        aria-pressed={on}
        aria-label="The lamp in the third-floor window. Press to switch it on or off."
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      />
    </SetPieceFrame>
  );
}
