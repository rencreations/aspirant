"use client";

import { useEffect, useRef } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { useDeviceTier } from "@/lib/device";
import { useIsTouch, useMounted, usePointer, useReducedMotion } from "@/lib/hooks";
import { clamp, mulberry32 } from "@/lib/math";

export interface EmberFieldProps {
  /** Fill the nearest positioned parent (a single section) instead of the whole viewport. */
  contained?: boolean;
  /** World palette. Default: follow the nearest [data-theme] (html for the fixed field). */
  theme?: "storm" | "daybreak";
  /** Particle count multiplier. Default 1. */
  density?: number;
  /** Two hex colours that replace the world palette (for example a character's), optional. */
  colors?: readonly [string, string];
  className?: string;
}

const MAX = 160;
const PUSH_RADIUS = 140;
const SPRITE = 48;

/** Bright light colours (match --light-* in tokens.css). */
const PALETTES = {
  storm: ["#ffa24a", "#b59cff"],
  daybreak: ["#5ce1ff", "#ffcf5c"],
} as const;

type World = keyof typeof PALETTES;

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function makeSprite(color: string, kind: "mote" | "shard"): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE;
  c.height = SPRITE;
  const g = c.getContext("2d");
  if (!g) return c;
  const mid = SPRITE / 2;
  if (kind === "mote") {
    const grad = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.18, rgba(color, 0.75));
    grad.addColorStop(0.45, rgba(color, 0.18));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
  } else {
    // Soft halo, then a thin bright sliver.
    const halo = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    halo.addColorStop(0, rgba(color, 0.35));
    halo.addColorStop(1, rgba(color, 0));
    g.save();
    g.translate(mid, mid);
    g.scale(0.32, 1);
    g.translate(-mid, -mid);
    g.fillStyle = halo;
    g.fillRect(0, 0, SPRITE, SPRITE);
    g.restore();
    const lin = g.createLinearGradient(mid, 3, mid, SPRITE - 3);
    lin.addColorStop(0, rgba(color, 0));
    lin.addColorStop(0.5, rgba(color, 1));
    lin.addColorStop(1, rgba(color, 0));
    g.fillStyle = lin;
    g.beginPath();
    g.moveTo(mid, 3);
    g.lineTo(mid + 2.2, mid);
    g.lineTo(mid, SPRITE - 3);
    g.lineTo(mid - 2.2, mid);
    g.closePath();
    g.fill();
  }
  return c;
}

/**
 * Drifting embers behind the page: cyan and gold motes in Daybreak, amber and violet shards
 * in Storm. The pointer pushes them, scroll speed stirs them. Count scales with the area and
 * drops on touch and weak devices; paused while the tab is hidden or the field is off screen;
 * not rendered under reduced motion. Mount once in the layout, or with `contained` inside a
 * `relative` section (put it first so the content paints above it).
 */
export function EmberField(props: EmberFieldProps) {
  const reduced = useReducedMotion();
  const mounted = useMounted();
  if (!mounted || reduced) return null;
  return <EmberCanvas {...props} />;
}

function EmberCanvas({
  contained = false,
  theme,
  density = 1,
  colors,
  className,
}: EmberFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: pointer } = usePointer();
  const touch = useIsTouch();
  const tier = useDeviceTier();
  const colorA = colors?.[0];
  const colorB = colors?.[1];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const rand = mulberry32(7);
    const xs = new Float32Array(MAX);
    const ys = new Float32Array(MAX);
    const vxs = new Float32Array(MAX);
    const vys = new Float32Array(MAX);
    const size = new Float32Array(MAX);
    const rot = new Float32Array(MAX);
    const spin = new Float32Array(MAX);
    const phase = new Float32Array(MAX);
    const depth = new Float32Array(MAX);
    const hue = new Uint8Array(MAX);

    const sprites: Record<World, [HTMLCanvasElement, HTMLCanvasElement]> = {
      storm: [
        makeSprite(colorA ?? PALETTES.storm[0], "shard"),
        makeSprite(colorB ?? PALETTES.storm[1], "shard"),
      ],
      daybreak: [
        makeSprite(colorA ?? PALETTES.daybreak[0], "mote"),
        makeSprite(colorB ?? PALETTES.daybreak[1], "mote"),
      ],
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let count = 0;
    let world: World = "storm";
    let raf = 0;
    let last = 0;
    let lastScroll = window.scrollY;
    let stir = 0;
    let inView = !contained;

    const themeHost = (): HTMLElement =>
      contained
        ? (canvas.parentElement?.closest<HTMLElement>("[data-theme]") ?? document.documentElement)
        : document.documentElement;

    const readTheme = () => {
      world = theme ?? (themeHost().dataset.theme === "daybreak" ? "daybreak" : "storm");
    };

    const seed = (i: number, anywhere: boolean) => {
      xs[i] = rand() * w;
      ys[i] = anywhere ? rand() * h : h + 10 + rand() * 40;
      vxs[i] = 0;
      vys[i] = 0;
      depth[i] = rand();
      size[i] = 0.45 + rand() * 0.75;
      rot[i] = rand() * Math.PI * 2;
      spin[i] = (rand() - 0.5) * 0.8;
      phase[i] = rand() * Math.PI * 2;
      hue[i] = rand() < 0.62 ? 0 : 1;
    };

    const resize = () => {
      const host = contained ? canvas.parentElement : null;
      w = host ? host.clientWidth : window.innerWidth;
      h = host ? host.clientHeight : window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      let n = ((w * h) / 14000) * density;
      if (touch) n *= 0.5;
      if (tier === "low") n *= 0.5;
      const next = Math.round(clamp(n, 24, MAX));
      for (let i = count; i < next; i++) seed(i, true);
      count = next;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const t = now / 1000;

      const sy = window.scrollY;
      const dy = sy - lastScroll;
      lastScroll = sy;
      stir += (clamp(dy, -80, 80) * 6 - stir) * Math.min(1, dt * 4);

      let ox = 0;
      let oy = 0;
      if (contained) {
        const r = canvas.getBoundingClientRect();
        ox = r.left;
        oy = r.top;
      }
      const p = pointer.current;
      const px = p.clientX - ox;
      const py = p.clientY - oy;
      const pushing = p.active;
      const shards = world === "storm";
      const set = sprites[world];

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = shards ? "lighter" : "source-over";

      for (let i = 0; i < count; i++) {
        const d = depth[i] ?? 0;
        const ph = phase[i] ?? 0;
        let vx = vxs[i] ?? 0;
        let vy = vys[i] ?? 0;
        let x = xs[i] ?? 0;
        let y = ys[i] ?? 0;
        // Base drift: upward, with a slow sway; scroll speed stirs the field.
        const targetVx = Math.sin(t * 0.35 + ph) * (6 + d * 8);
        const targetVy = -(7 + d * 16) - stir * (0.2 + d * 0.4);
        const k = Math.min(1, dt * 1.6);
        vx += (targetVx - vx) * k;
        vy += (targetVy - vy) * k;
        if (pushing) {
          const dx = x - px;
          const dyp = y - py;
          const dist2 = dx * dx + dyp * dyp;
          if (dist2 < PUSH_RADIUS * PUSH_RADIUS && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const f = 1 - dist / PUSH_RADIUS;
            const force = f * f * 900 * dt;
            vx += (dx / dist) * force;
            vy += (dyp / dist) * force;
          }
        }
        x += vx * dt;
        y += vy * dt;
        if (y < -24) {
          y = h + 20;
          x = rand() * w;
        } else if (y > h + 30) {
          y = -20;
        }
        if (x < -24) x = w + 20;
        else if (x > w + 24) x = -20;
        xs[i] = x;
        ys[i] = y;
        vxs[i] = vx;
        vys[i] = vy;

        const sprite = hue[i] === 1 ? set[1] : set[0];
        const s = (size[i] ?? 1) * (0.55 + d * 0.65);
        ctx.globalAlpha = (0.35 + d * 0.5) * (0.65 + 0.35 * Math.sin(t * (0.8 + d) + ph));
        if (shards) {
          const r = (rot[i] ?? 0) + (spin[i] ?? 0) * dt + vx * 0.0008;
          rot[i] = r;
          const c = Math.cos(r) * s * dpr;
          const sn = Math.sin(r) * s * dpr;
          ctx.setTransform(c, sn, -sn, c, x * dpr, y * dpr);
          ctx.drawImage(sprite, -SPRITE / 2, -SPRITE / 2);
        } else {
          const m = s * dpr * 0.6;
          ctx.setTransform(m, 0, 0, m, x * dpr, y * dpr);
          ctx.drawImage(sprite, -SPRITE / 2, -SPRITE / 2);
        }
      }
      ctx.globalAlpha = 1;
      schedule();
    };

    const running = () => inView && !document.hidden;
    function schedule() {
      if (!raf && running()) raf = requestAnimationFrame(frame);
    }
    const wake = () => {
      last = performance.now();
      lastScroll = window.scrollY;
      schedule();
    };

    readTheme();
    resize();

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const themeObserver = new MutationObserver(readTheme);
    if (!theme) {
      themeObserver.observe(themeHost(), { attributes: true, attributeFilter: ["data-theme"] });
    }

    let resizeObserver: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    if (contained && canvas.parentElement) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement);
      io = new IntersectionObserver(([entry]) => {
        inView = entry?.isIntersecting ?? false;
        if (inView) wake();
        else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
      io.observe(canvas);
    } else {
      window.addEventListener("resize", resize, { passive: true });
    }

    wake();

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
      resizeObserver?.disconnect();
      io?.disconnect();
    };
  }, [contained, theme, density, touch, tier, pointer, colorA, colorB]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none block h-full w-full",
        contained ? "absolute inset-0 z-0" : "fixed inset-0 z-(--z-ember)",
        className,
      )}
    />
  );
}
