"use client";

import { useEffect, useRef, type RefObject } from "react";

import { audio } from "@/lib/audio";
import { useInView, usePageVisible, useReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";

import { CITY, makeLayout, type Layout, type SceneFocus } from "./sphere-layout";

interface Ripple {
  x: number;
  y: number;
  t0: number;
  power: number;
}

export interface SceneControl {
  /** Which callout is lit (hover, focus or tap on its card). */
  focus: SceneFocus | null;
  /** Ask for a ripple from a point, in 0 to 1 stage coordinates. */
  ripple: (x: number, y: number, power?: number) => void;
}

const MAX_RIPPLES = 6;
const SKY = ["#071632", "#173565", "#5d88c2", "#f2c58b", "#ffe9bd"] as const;

/** Window positions on a building, deterministic from its index. */
function windowsOf(index: number, w: number, h: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const cols = Math.max(1, Math.floor(w / 6));
  const rows = Math.max(1, Math.floor(h / 9));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((index * 7 + r * 5 + c * 3) % 5 < 2) out.push({ x: c, y: r });
    }
  }
  return out;
}

/** Paint the parts that never move: sky, stars, sun, hills, city, lake. */
function paintStatic(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { w, h, shoreY } = layout;
  const sky = ctx.createLinearGradient(0, 0, 0, shoreY);
  SKY.forEach((c, i) => sky.addColorStop(i / (SKY.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun glow low on the horizon, left of the dome.
  const sun = ctx.createRadialGradient(w * 0.24, shoreY, 0, w * 0.24, shoreY, w * 0.5);
  sun.addColorStop(0, "rgba(255,238,190,0.95)");
  sun.addColorStop(0.25, "rgba(255,207,92,0.35)");
  sun.addColorStop(1, "rgba(255,207,92,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, shoreY);

  // A few stars in the dark upper sky.
  for (let i = 0; i < 46; i++) {
    const x = ((i * 9301 + 49297) % 233280) / 233280;
    const y = (((i * 7919 + 1013) % 4093) / 4093) * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + ((i * 13) % 10) / 20})`;
    ctx.fillRect(x * w, y * shoreY, 1.4, 1.4);
  }

  // Two ranges of green hills.
  const hills = (base: number, amp: number, color: string, phase: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, shoreY);
    for (let x = 0; x <= w; x += 8) {
      const y =
        shoreY -
        base -
        amp *
          (0.55 * Math.sin(x / (w * 0.13) + phase) + 0.45 * Math.sin(x / (w * 0.043) + phase * 2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, shoreY);
    ctx.closePath();
    ctx.fill();
  };
  hills(h * 0.09, h * 0.05, "#3f8f66", 1.2);
  hills(h * 0.045, h * 0.03, "#2b6e4c", 3.4);

  // The city on the far shore.
  ctx.fillStyle = "#0b1a36";
  CITY.forEach((b) => {
    const bx = b.x * w;
    const bw = b.w * w;
    const bh = b.h * h;
    ctx.fillRect(bx, shoreY - bh, bw, bh);
    if (b.spire) {
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.5 - 1, shoreY - bh);
      ctx.lineTo(bx + bw * 0.5, shoreY - bh - h * 0.04);
      ctx.lineTo(bx + bw * 0.5 + 1, shoreY - bh);
      ctx.fill();
    }
  });
  // Warm windows.
  CITY.forEach((b, i) => {
    const bx = b.x * w;
    const bw = b.w * w;
    const bh = b.h * h;
    windowsOf(i, bw, bh).forEach((win) => {
      ctx.fillStyle = "rgba(255,217,138,0.78)";
      ctx.fillRect(bx + 3 + win.x * 6, shoreY - bh + 5 + win.y * 9, 2.2, 3.2);
    });
  });

  // Selrick Academy: one tall tower with a lamp at the top.
  const a = layout.academy;
  ctx.fillStyle = "#08122a";
  ctx.fillRect(a.x - a.w / 2, a.top, a.w, shoreY - a.top);
  ctx.fillRect(
    a.x - a.w * 1.05,
    a.top + (shoreY - a.top) * 0.55,
    a.w * 2.1,
    (shoreY - a.top) * 0.45,
  );
  ctx.beginPath();
  ctx.moveTo(a.x - a.w * 0.7, a.top);
  ctx.lineTo(a.x, a.top - h * 0.05);
  ctx.lineTo(a.x + a.w * 0.7, a.top);
  ctx.fill();

  // The lake: pale at the shore, deep in front.
  const lake = ctx.createLinearGradient(0, shoreY, 0, h);
  lake.addColorStop(0, "#a8d3ee");
  lake.addColorStop(0.35, "#4f8fc4");
  lake.addColorStop(1, "#12356a");
  ctx.fillStyle = lake;
  ctx.fillRect(0, shoreY, w, h - shoreY);

  // Mirror the city faintly into the water.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.translate(0, shoreY * 2);
  ctx.scale(1, -1);
  ctx.fillStyle = "#0b1a36";
  CITY.forEach((b) => {
    ctx.fillRect(b.x * w, shoreY - b.h * h, b.w * w, b.h * h);
  });
  ctx.restore();
  // Clip anything that mirrored below the stage.
  ctx.clearRect(0, h, w, h);
}

function drawPlanet(ctx: CanvasRenderingContext2D, layout: Layout, t: number, lit: number): void {
  const { x, y, r } = layout.planet;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const sea = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  sea.addColorStop(0, "#6fd0a0");
  sea.addColorStop(0.55, "#2f8f63");
  sea.addColorStop(1, "#0f3d4f");
  ctx.fillStyle = sea;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Continents and clouds drift across the disc.
  const drift = (t * 6) % (r * 2.6);
  for (let i = 0; i < 4; i++) {
    const px = x - r * 1.3 + ((drift + i * r * 0.65) % (r * 2.6));
    ctx.fillStyle = i % 2 ? "rgba(34,120,76,0.8)" : "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.ellipse(px, y - r * 0.5 + i * r * 0.34, r * 0.5, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Terminator shadow.
  const shade = ctx.createLinearGradient(x - r, y, x + r, y);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(3,10,30,0.7)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  ctx.strokeStyle = `rgba(160,245,255,${0.35 + lit * 0.6})`;
  ctx.lineWidth = 1 + lit * 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([2, 6]);
  ctx.strokeStyle = "rgba(160,245,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.55, r * 0.5, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

interface SphereSceneProps {
  /** Mutable control shared with the legend. */
  control: RefObject<SceneControl>;
  className?: string;
  /** Called with the layout whenever the stage resizes (for the HTML callouts). */
  onLayout?: (layout: Layout) => void;
}

/**
 * The opening scene, drawn on one canvas: Dawnbreak, Terrinia, the Academy tower and the
 * Defence Sphere. The Sphere is a hex dome that ripples where the pointer moves, where a
 * finger lands or when a legend card is pressed. It breathes on its own while idle. Under
 * reduced motion it draws still and only answers to input.
 */
export function SphereScene({ control, className, onLayout }: SphereSceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(wrapRef, { rootMargin: "120px" });
  const visible = usePageVisible();
  const running = inView && visible;

  const live = useRef({
    layout: null as Layout | null,
    back: null as HTMLCanvasElement | null,
    dpr: 1,
    ripples: [] as Ripple[],
    px: -1,
    py: -1,
    pointerOn: false,
    lastSpawnX: -999,
    lastSpawnY: -999,
    idleAt: 0,
    focusLit: { dawnbreak: 0, terrinia: 0, "selrick-academy": 0, "defence-sphere": 0 } as Record<
      SceneFocus,
      number
    >,
    px01: 0,
    dirty: true,
    time: 0,
  });

  const onLayoutRef = useRef(onLayout);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    onLayoutRef.current = onLayout;
    reducedRef.current = reduced;
  });

  // Drawing is one closure so the loop and the on-demand redraw share it.
  const drawRef = useRef<(dt: number, t: number) => void>(() => undefined);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = live.current;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      const dpr = Math.min(1.75, window.devicePixelRatio || 1);
      s.dpr = dpr;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const layout = makeLayout(rect.width, rect.height);
      s.layout = layout;
      const back = document.createElement("canvas");
      back.width = canvas.width;
      back.height = canvas.height;
      const bctx = back.getContext("2d");
      if (bctx) {
        bctx.scale(dpr, dpr);
        paintStatic(bctx, layout);
      }
      s.back = back;
      s.dirty = true;
      onLayoutRef.current?.(layout);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const spawn = (x: number, y: number, power = 1) => {
      if (reducedRef.current) {
        s.dirty = true;
        return;
      }
      s.ripples.push({ x, y, t0: s.time, power });
      if (s.ripples.length > MAX_RIPPLES) s.ripples.shift();
      s.dirty = true;
    };

    const local = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, r };
    };
    const onMove = (e: PointerEvent) => {
      const { x, y, r } = local(e);
      s.px = x;
      s.py = y;
      s.px01 = (x / r.width) * 2 - 1;
      s.pointerOn = true;
      s.dirty = true;
      const d = Math.hypot(x - s.lastSpawnX, y - s.lastSpawnY);
      if (d > 90) {
        s.lastSpawnX = x;
        s.lastSpawnY = y;
        spawn(x, y, 0.7);
      }
    };
    const onDown = (e: PointerEvent) => {
      const { x, y } = local(e);
      s.px = x;
      s.py = y;
      s.pointerOn = true;
      spawn(x, y, 1.2);
      audio.blip("hover");
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || e.type === "pointercancel") s.pointerOn = false;
      s.dirty = true;
    };
    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerdown", onDown, { passive: true });
    wrap.addEventListener("pointerleave", onLeave, { passive: true });
    wrap.addEventListener("pointercancel", onLeave, { passive: true });
    wrap.addEventListener("pointerup", onLeave, { passive: true });

    const c = control.current;
    c.ripple = (nx, ny, power = 1.3) => {
      const l = s.layout;
      if (l) spawn(nx * l.w, ny * l.h, power);
    };

    return () => {
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointercancel", onLeave);
      wrap.removeEventListener("pointerup", onLeave);
    };
  }, [control]);

  useEffect(() => {
    const s = live.current;
    drawRef.current = (dt, t) => {
      const canvas = canvasRef.current;
      const layout = s.layout;
      const back = s.back;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !layout || !back) return;
      s.time = t;
      const { w, h, shoreY } = layout;
      const focus = control.current.focus;

      // Ease each callout's light toward its target.
      (Object.keys(s.focusLit) as SceneFocus[]).forEach((k) => {
        const target = focus === k ? 1 : 0;
        s.focusLit[k] += (target - s.focusLit[k]) * clamp(dt * 8, 0, 1);
      });

      // Idle breath: a slow ripple from the apex every few seconds.
      if (!reduced && t > s.idleAt) {
        s.idleAt = t + 5.5;
        s.ripples.push({ x: layout.domeX, y: shoreY - layout.domeRy, t0: t, power: 0.6 });
        if (s.ripples.length > MAX_RIPPLES) s.ripples.shift();
      }
      s.ripples = s.ripples.filter((r) => t - r.t0 < 2.4);

      const parallax = reduced ? 0 : s.px01;
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(back, 0, 0, w, h);

      drawPlanet(ctx, layout, reduced ? 0 : t, s.focusLit.dawnbreak);

      // Window flicker over the city, brighter when Terrinia is lit.
      const lit = s.focusLit.terrinia;
      CITY.forEach((b, i) => {
        if (i % 3 !== 0) return;
        const flick = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + (i % 5) * 0.17) + i));
        ctx.fillStyle = `rgba(255,236,170,${(reduced ? 0.5 : flick * 0.6) + lit * 0.4})`;
        ctx.fillRect(b.x * w + b.w * w * 0.4, shoreY - b.h * h * 0.6, 2.4, 3.4);
      });

      // Academy lamp and halo.
      const a = layout.academy;
      const academyLit = s.focusLit["selrick-academy"];
      const halo = ctx.createRadialGradient(
        a.x,
        a.top - h * 0.05,
        0,
        a.x,
        a.top - h * 0.05,
        26 + academyLit * 46,
      );
      halo.addColorStop(0, `rgba(255,222,140,${0.9})`);
      halo.addColorStop(1, "rgba(255,222,140,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(a.x - 90, a.top - h * 0.05 - 90, 180, 180);
      if (academyLit > 0.02) {
        ctx.strokeStyle = `rgba(255,222,140,${academyLit * 0.9})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(a.x - a.w * 1.6, a.top - h * 0.055, a.w * 3.2, shoreY - a.top + h * 0.055);
      }

      // Lake glints and the reflected sun.
      for (let i = 0; i < 26; i++) {
        const ly = shoreY + 6 + ((i * 37) % (h - shoreY - 8));
        const lx = (((i * 131 + 17) % 997) / 997) * w;
        const len = 14 + ((i * 11) % 36);
        const tw = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7);
        ctx.fillStyle = `rgba(255,244,214,${0.1 + tw * 0.28})`;
        ctx.fillRect(lx + Math.sin(t * 0.4 + i) * 3, ly, len, 1.2);
      }
      const streak = ctx.createLinearGradient(0, shoreY, 0, h);
      streak.addColorStop(0, "rgba(255,230,170,0.5)");
      streak.addColorStop(1, "rgba(255,230,170,0)");
      ctx.fillStyle = streak;
      ctx.beginPath();
      ctx.moveTo(w * 0.22, shoreY);
      ctx.lineTo(w * 0.28, shoreY);
      ctx.lineTo(w * 0.34, h);
      ctx.lineTo(w * 0.17, h);
      ctx.closePath();
      ctx.fill();

      // The Defence Sphere: hexes lit by ripples, the pointer and the callout.
      const sphereLit = s.focusLit["defence-sphere"];
      const pr = layout.hexR * 5.5;
      ctx.lineWidth = 1;
      const offX = parallax * 6;
      for (const hex of layout.hexes) {
        let e = 0;
        for (const rp of s.ripples) {
          const age = t - rp.t0;
          const ring = age * 340;
          const d = Math.hypot(hex.x - rp.x, hex.y - rp.y);
          const band = Math.abs(d - ring) / (layout.hexR * 2.2);
          if (band < 3) e += Math.exp(-band * band) * (1 - age / 2.4) * rp.power;
        }
        if (s.pointerOn) {
          const d = Math.hypot(hex.x - s.px, hex.y - s.py);
          if (d < pr) e += (1 - d / pr) ** 2 * 0.9;
        }
        const idle = reduced ? 0.12 : 0.1 + 0.05 * Math.sin(t * 0.9 - hex.depth * 3);
        const base = (hex.rim ? 0.34 : 0.2) + idle;
        const k = clamp(base + e + sphereLit * 0.35, 0, 1);
        hexPath(ctx, hex.x + offX, hex.y, layout.hexR * 0.94);
        if (k > 0.42) {
          ctx.fillStyle = `rgba(190,246,255,${(k - 0.35) * 0.38})`;
          ctx.fill();
        }
        ctx.strokeStyle = `rgba(150,238,255,${0.16 + k * 0.78})`;
        ctx.stroke();
      }
      // Rim line where the dome meets the shore.
      ctx.strokeStyle = `rgba(160,242,255,${0.55 + sphereLit * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(
        layout.domeX + offX,
        shoreY,
        layout.domeRx,
        layout.domeRy,
        0,
        Math.PI,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.lineWidth = 1;
    };
  }, [control, reduced]);

  // One loop while visible. Under reduced motion it only draws when something changed.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let lastFocus: SceneFocus | null | undefined;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = live.current;
      const focus = control.current.focus;
      const settling = Object.values(s.focusLit).some((v) => v > 0.01 && v < 0.99);
      if (!reduced || s.dirty || focus !== lastFocus || settling) {
        drawRef.current(dt, now / 1000);
        s.dirty = false;
        lastFocus = focus;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, reduced, control]);

  return (
    <div ref={wrapRef} className={className} style={{ touchAction: "pan-y" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
