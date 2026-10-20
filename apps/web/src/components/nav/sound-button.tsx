"use client";

import { cn } from "@aspirant/ui/lib/utils";
import gsap from "gsap";
import { useEffect, useRef } from "react";

import { audio } from "@/lib/audio";
import { useMounted, useReducedMotion } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import styles from "./sound-button.module.css";

const BARS = 7;
const BAR_W = 1.8;
const GAP = 1.6;
const VIEW_W = BARS * BAR_W + (BARS - 1) * GAP;
const VIEW_H = 20;
const MAX_H = 16;
/** Per-bar weight, so the wave has a body: calm at the edges, tall in the middle. */
const WAVE_W = VIEW_W * 1.15;
const WAVE_H = VIEW_H * 1.15;
const SHAPE = [0.45, 0.7, 0.92, 1, 0.92, 0.7, 0.45];

interface Sim {
  /** 0 flat dots, 1 full wave. Eased by GSAP. */
  amp: number;
  /** Extra energy on press, decays. */
  kick: number;
  /** Phase speed multiplier. */
  speed: number;
  phase: number;
}

/**
 * The sound button. A row of bars that move like a waveform while sound is on and settle into
 * a flat line of dots when it is off. Hover lifts the wave, a press kicks it and sends a ring
 * out. State is driven by `audio` through the site store; the M key does the same (wired once
 * in <HudFrame>). `aria-pressed` means "sound is on".
 */
export function SoundButton({ className }: { className?: string }) {
  const muted = useSiteStore((s) => s.muted);
  const toggleMute = useSiteStore((s) => s.toggleMute);
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const on = mounted && !muted;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** The bars' colour (the button's text colour), read now and then, never every frame. */
  const ink = useRef({ colour: "#fff", at: 0 });
  const ringRef = useRef<HTMLSpanElement>(null);
  const sim = useRef<Sim>({ amp: 0, kick: 0, speed: 1, phase: 0 });
  const hover = useRef(false);

  /**
   * The bars are drawn on a canvas. Moving SVG attributes every frame restyles the page on every
   * frame the sound is on, and this button is on every page.
   */
  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Sharp on a dense screen (capped at 2: the bars are tiny). Sized here, not in the markup, so
    // the server and the browser render the same markup.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(WAVE_W * dpr);
    if (canvas.width !== w) {
      canvas.width = w;
      canvas.height = Math.round(WAVE_H * dpr);
    }
    const now = performance.now();
    if (now - ink.current.at > 120) {
      ink.current = { colour: getComputedStyle(canvas).color, at: now };
    }
    const k = canvas.width / VIEW_W;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ink.current.colour;
    const s = sim.current;
    for (let i = 0; i < BARS; i++) {
      const wave = 0.5 + 0.5 * Math.sin(s.phase * 4.2 + i * 0.95);
      const h = BAR_W + (MAX_H - BAR_W) * Math.min(1, s.amp * (0.18 + 0.82 * wave) * SHAPE[i]!);
      const x = i * (BAR_W + GAP) * k;
      const y = ((VIEW_H - h) / 2) * k;
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_W * k, h * k, (BAR_W / 2) * k);
      ctx.fill();
    }
  };

  const aim = () => {
    const s = sim.current;
    const target = on ? (hover.current ? 1.3 : 1) : hover.current ? 0.22 : 0;
    gsap.to(s, {
      amp: target,
      speed: on ? (hover.current ? 1.7 : 1) : 0.6,
      duration: reduced ? 0 : on ? 0.6 : 0.5,
      ease: on ? "elastic.out(1, 0.6)" : "power3.out",
      overwrite: "auto",
      onUpdate: reduced ? undefined : draw,
      onComplete: draw,
    });
  };

  // Follow the sound state.
  useEffect(() => {
    aim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, reduced]);

  // The wave itself, on the GSAP ticker, only while something moves.
  useEffect(() => {
    if (reduced) {
      draw();
      return;
    }
    const s = sim.current;
    const tick = (_t: number, dtMs: number) => {
      const dt = dtMs / 1000;
      s.kick *= Math.exp(-dt * 4);
      if (s.amp < 0.004 && s.kick < 0.01) return;
      s.phase += dt * s.speed * (1 + s.kick * 2);
      draw();
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [reduced]);

  const ring = () => {
    const el = ringRef.current;
    if (!el || reduced) return;
    gsap.fromTo(
      el,
      { scale: 0.7, opacity: 0.7 },
      { scale: 1.9, opacity: 0, duration: 0.7, ease: "power3.out", overwrite: true },
    );
  };

  return (
    <button
      type="button"
      className={cn(styles.sound, className)}
      aria-pressed={on}
      aria-keyshortcuts="M"
      data-on={on}
      data-cursor="SOUND"
      title="Sound (M)"
      onPointerEnter={() => {
        hover.current = true;
        aim();
      }}
      onPointerLeave={() => {
        hover.current = false;
        aim();
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) {
          hover.current = true;
          aim();
        }
      }}
      onBlur={() => {
        hover.current = false;
        aim();
      }}
      onClick={() => {
        audio.unlock();
        toggleMute();
        sim.current.kick = 1;
        ring();
        if (muted) window.setTimeout(() => audio.blip("click"), 30);
      }}
    >
      <span ref={ringRef} className={styles.ring} aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className={styles.wave}
        width={WAVE_W}
        height={WAVE_H}
        style={{ width: WAVE_W, height: WAVE_H }}
        aria-hidden="true"
      />
      <span className={styles.state} aria-hidden="true">
        <span className={styles.stateOn}>On</span>
        <span className={styles.stateOff}>Off</span>
      </span>
      <span className="sr-only">Sound</span>
    </button>
  );
}
