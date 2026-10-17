"use client";

import { useEffect, useRef, useState } from "react";

import type { SetPieceProps } from "../../contract";
import { SetPieceFrame } from "./frame";
import { ease, glow, star4, useLive } from "./live";
import styles from "./setpieces.module.css";
import { note, wake } from "./synth";
import { useStage, type StageSize } from "./useStage";

interface Line {
  who: "Ruby" | "Angela";
  text: string;
}

/** The exchanges so far, in story order, exactly as told. */
const RUBY_ASKS: Array<{ place: string; light: string; lines: Line[] }> = [
  {
    place: "The cyan bay, the night Angela woke",
    light: "#7fe8ff",
    lines: [
      { who: "Ruby", text: "Does it hurt?" },
      { who: "Angela", text: "What does hurt mean?" },
      { who: "Ruby", text: "Hurt is a warning. It tells you something inside is damaged." },
    ],
  },
  {
    place: "The training bay, after they took her pain away",
    light: "#9fb0c8",
    lines: [
      { who: "Ruby", text: "Does it hurt?" },
      { who: "Angela", text: "I do not know. I looked for it. I cannot find it." },
      {
        who: "Angela",
        text: "Then you must feel it for me. Every day, ask me, Does it hurt? I will say, I do not know. You will tell me what you see. Between us, we will know.",
      },
    ],
  },
];

const ANGELA_ASKS = {
  place: "The dark hold of a command ship",
  light: "#ff6ac8",
  lines: [
    { who: "Angela", text: "You are crying. Is it a malfunction?" },
    { who: "Ruby", text: "No. It is a leak." },
    { who: "Angela", text: "Does it hurt?" },
    { who: "Ruby", text: "Yes." },
    { who: "Angela", text: "I thought so. I will hold you." },
    { who: "Ruby", text: "I am supposed to hold you." },
    { who: "Angela", text: "We can take turns." },
  ] as Line[],
};

/** Ruby and Angela's question, asked every day: the answers so far, and taking turns. */
export default function DoesItHurt({ active, reduced }: SetPieceProps) {
  const [turns, setTurns] = useState(false);
  const [step, setStep] = useState(-1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const light = useRef({ r: 0, beat: 0 });
  const [message, announce] = useLive();

  const scenes = turns ? [ANGELA_ASKS] : RUBY_ASKS;
  const flat = scenes.flatMap((s, si) => s.lines.map((l) => ({ ...l, si })));
  const current = step >= 0 ? flat[Math.min(step, flat.length - 1)] : undefined;
  const scene = scenes[current?.si ?? 0] ?? RUBY_ASKS[0]!;

  const ask = () => {
    wake();
    const next = step + 1 >= flat.length ? 0 : step + 1;
    setStep(next);
    const line = flat[next];
    if (line) {
      announce(`${line.who}: ${line.text}`);
      note(line.who === "Ruby" ? 392 : 523.25, { gain: 0.035, dur: 1.1 });
      light.current.beat = 1;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, { w, h }: StageSize, dt: number, t: number) => {
    const L = light.current;
    L.r = reduced ? 1 : ease(L.r, 1, 2, dt);
    L.beat = Math.max(0, L.beat - dt * 1.5);
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w / 2, h * 0.45, Math.max(w, h) * 0.6, hexA(scene.light, 0.22), L.r);

    const s = Math.min(w, h);
    // Ruby: navy and gold, a white four-pointed star in a blue eye.
    const rx = w * 0.34;
    const ax = w * 0.66;
    const cy = h * 0.42;
    const rubyTalks = current?.who === "Ruby";
    glow(ctx, rx, cy, s * 0.22, "rgba(40,60,140,0.9)", 0.7 + (rubyTalks ? L.beat * 0.3 : 0));
    glow(ctx, rx, cy, s * 0.1, "rgba(255,207,92,0.7)");
    ctx.fillStyle = "#eef4ff";
    star4(ctx, rx, cy, s * 0.035, 0.2);
    ctx.fill();
    // Angela: peach, magenta star specks, a small pump that ticks.
    const tick = reduced ? 0.5 : Math.max(0, Math.sin(t * 5.2)) ** 8;
    glow(
      ctx,
      ax,
      cy,
      s * 0.22,
      "rgba(255,190,150,0.85)",
      0.7 + (!rubyTalks && current ? L.beat * 0.3 : 0),
    );
    glow(ctx, ax, cy + s * 0.02, s * (0.05 + tick * 0.03), "rgba(255,120,190,0.95)");
    for (let i = 0; i < 6; i++) {
      const a = t * (reduced ? 0 : 0.3) + (i / 6) * Math.PI * 2;
      ctx.fillStyle = "#ff6ac8";
      star4(ctx, ax + Math.cos(a) * s * 0.15, cy + Math.sin(a) * s * 0.15, s * 0.012, 0.25);
      ctx.fill();
    }
    ctx.font = `${Math.round(s * 0.035)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(220,230,245,0.8)";
    ctx.fillText("RUBY", rx, cy + s * 0.3);
    ctx.fillText("ANGELA", ax, cy + s * 0.3);
    ctx.fillStyle = "rgba(220,230,245,0.55)";
    ctx.fillText(scene.place.toUpperCase(), w / 2, h * 0.09);

    // The line being said, set like the narrator's voice.
    if (current) {
      ctx.font = `italic ${Math.round(s * 0.05)}px "Instrument Serif", serif`;
      ctx.fillStyle = "#f4f0ea";
      wrap(ctx, current.text, w / 2, h * 0.8, w * 0.84, s * 0.06);
    }
    ctx.textAlign = "start";
  };

  const { redraw } = useStage(canvasRef, draw, active && !reduced);
  useEffect(() => {
    redraw();
  }, [step, turns, redraw]);

  return (
    <SetPieceFrame
      id="does-it-hurt"
      code={turns ? "ANGELA ASKS" : "RUBY ASKS"}
      accent="var(--magenta)"
      footer={
        <>
          <button type="button" className={styles.button} onClick={ask}>
            Ask
          </button>
          <button
            type="button"
            className={styles.button}
            aria-pressed={turns}
            onClick={() => {
              wake();
              setTurns((v) => !v);
              setStep(-1);
              announce(turns ? "Ruby asks." : "Angela asks.");
            }}
          >
            Take turns
          </button>
          <span className={styles.readout}>
            {current ? `${current.who}: ${current.text}` : "Press Ask."}
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
        role="img"
        aria-label={`Ruby and Angela as two lights. ${scene.place}.${current ? ` ${current.who} says: ${current.text}` : ""}`}
      />
    </SetPieceFrame>
  );
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  max: number,
  lh: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const top = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
}
