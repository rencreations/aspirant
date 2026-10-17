"use client";

import { useEffect, useRef, type RefObject } from "react";

import { lerp, clamp } from "@/lib/math";

import { useCanvasLoop } from "../use-canvas-loop";
import { scoreOf, stageOf } from "./coupling-math";

export interface LabView {
  /** 0 apart, 1 touching. Written by the UI and by dragging. */
  closeness: number;
  colours: readonly [string, string];
  labels: readonly [string, string] | null;
  /** Has the visitor touched the lab yet? Until then the right crystal invites a drag. */
  touched: boolean;
}

export interface LabCanvasProps {
  view: RefObject<LabView>;
  /** Called while dragging, with the new closeness. */
  onDrag: (closeness: number) => void;
  onDragEnd: () => void;
  onDragStart: () => void;
  className?: string;
}

function hexPath(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (Math.PI / 3) * i;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** Four-pointed star with concave sides, like the Emblem of Hope. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + (Math.PI / 2) * i;
    const tip = [x + Math.cos(a) * r, y + Math.sin(a) * r] as const;
    const next = a + Math.PI / 2;
    const nextTip = [x + Math.cos(next) * r, y + Math.sin(next) * r] as const;
    if (i === 0) g.moveTo(tip[0], tip[1]);
    g.quadraticCurveTo(x, y, nextTip[0], nextTip[1]);
  }
  g.closePath();
}

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  k: i / 26,
  lane: (i * 7) % 5,
  speed: 0.25 + ((i * 13) % 10) / 24,
}));

/**
 * The lab's screen: two crystals on a ruler. Drag either one toward the other. The field
 * between them thickens, and at the thresholds the Emblem of Hope stars wake, link and merge.
 * Paused off screen; static under reduced motion.
 */
export default function LabCanvas({
  view,
  onDrag,
  onDragEnd,
  onDragStart,
  className,
}: LabCanvasProps) {
  const drag = useRef<"L" | "R" | null>(null);
  const geom = useRef({ cx: 0, w: 0, h: 0, r: 0, maxGap: 0, minGap: 0 });
  const callbacks = useRef({ onDrag, onDragEnd, onDragStart });
  const merged = useRef(0);

  useEffect(() => {
    callbacks.current = { onDrag, onDragEnd, onDragStart };
  });

  const { wrapRef, canvasRef, markDirty } = useCanvasLoop((g, w, h, t) => {
    const v = view.current;
    const r = Math.min(h * 0.16, w * 0.07);
    const cx = w / 2;
    const cy = h * 0.52;
    const maxGap = Math.max(r * 4, w * 0.66);
    const minGap = r * 2.05;
    geom.current = { cx, w, h, r, maxGap, minGap };
    const c = clamp(v.closeness);
    const gap = lerp(maxGap, minGap, c);
    const lx = cx - gap / 2;
    const rx = cx + gap / 2;
    const score = scoreOf(c);
    const stage = stageOf(score);
    const still = t === 0;

    // Screen: soft vignette and a dot grid.
    const bg = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
    bg.addColorStop(0, `rgba(${stage >= 3 ? "60,48,18" : "18,30,52"},1)`);
    bg.addColorStop(1, "rgba(5,7,12,1)");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(170,196,235,0.16)";
    for (let x = 14; x < w; x += 28) for (let y = 14; y < h; y += 28) g.fillRect(x, y, 1.2, 1.2);

    // Ruler under the crystals.
    const ry = cy + r * 2.3;
    g.strokeStyle = "rgba(170,196,235,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(lx, ry);
    g.lineTo(rx, ry);
    g.stroke();
    for (let i = 0; i <= 10; i++) {
      const x = lerp(lx, rx, i / 10);
      g.beginPath();
      g.moveTo(x, ry - (i % 5 === 0 ? 7 : 3));
      g.lineTo(x, ry + (i % 5 === 0 ? 7 : 3));
      g.stroke();
    }

    // Field lines between the crystals.
    const amp = r * (0.15 + c * 0.7);
    for (let lane = 0; lane < 5; lane++) {
      g.beginPath();
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const x = lerp(lx + r, rx - r, f);
        const env = Math.sin(f * Math.PI);
        const y =
          cy +
          Math.sin(f * 9 + t * (1.2 + lane * 0.3) + lane) * amp * env * ((lane - 2) * 0.4 + 0.4) +
          (lane - 2) * r * 0.22 * env;
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      const grad = g.createLinearGradient(lx, 0, rx, 0);
      grad.addColorStop(0, v.colours[0]);
      grad.addColorStop(1, v.colours[1]);
      g.strokeStyle = grad;
      g.globalAlpha = 0.12 + c * 0.6;
      g.lineWidth = 1.2;
      g.stroke();
      g.globalAlpha = 1;
    }
    // Particles run along the field, faster the closer the pair.
    for (const p of PARTICLES) {
      const f = (((p.k + t * p.speed * (0.05 + c * 0.35)) % 1) + 1) % 1;
      const x = lerp(lx + r, rx - r, f);
      const y = cy + (p.lane - 2) * r * 0.2 * Math.sin(f * Math.PI);
      g.fillStyle = f < 0.5 ? v.colours[0] : v.colours[1];
      g.globalAlpha = (0.2 + c * 0.7) * Math.sin(f * Math.PI);
      g.fillRect(x - 1.2, y - 1.2, 2.6, 2.6);
    }
    g.globalAlpha = 1;

    // Crystals.
    const bob = still ? 0 : Math.sin(t * 1.4) * r * 0.05;
    const crystal = (x: number, colour: string, side: 0 | 1) => {
      const y = cy + (side ? bob : -bob);
      const pulse = still ? 1 : 1 + Math.sin(t * 3 + side * 2) * 0.04 * (0.4 + c);
      const halo = g.createRadialGradient(x, y, 0, x, y, r * (2.6 + c * 1.6));
      halo.addColorStop(0, colour);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.28 + c * 0.35;
      g.fillStyle = halo;
      g.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);
      g.globalAlpha = 1;
      hexPath(g, x, y, r * pulse, Math.PI / 6);
      const body = g.createLinearGradient(x - r, y - r, x + r, y + r);
      body.addColorStop(0, "rgba(255,255,255,0.95)");
      body.addColorStop(0.45, colour);
      body.addColorStop(1, "rgba(20,26,37,0.9)");
      g.fillStyle = body;
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * r * pulse, y + Math.sin(a) * r * pulse);
        g.stroke();
      }
      if (v.labels) {
        g.fillStyle = "rgba(238,243,250,0.92)";
        g.font = `600 ${Math.max(11, r * 0.34)}px "JetBrains Mono Variable", monospace`;
        g.textAlign = "center";
        g.fillText(v.labels[side].toUpperCase(), x, y + r * 1.75);
      }
    };
    crystal(lx, v.colours[0], 0);
    crystal(rx, v.colours[1], 1);

    // Invitation: a ring around the right crystal until the visitor has touched the lab.
    if (!v.touched && !still) {
      g.strokeStyle = "rgba(255,229,138,0.8)";
      g.lineWidth = 1.5;
      g.setLineDash([4, 6]);
      g.beginPath();
      g.arc(rx, cy, r * (1.5 + 0.15 * Math.sin(t * 3)), 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(255,229,138,0.9)";
      g.font = `500 ${Math.max(11, r * 0.3)}px "JetBrains Mono Variable", monospace`;
      g.textAlign = "center";
      g.fillText("DRAG ME", rx, cy - r * 2);
    }

    // Emblem of Hope stars: wake, link, merge.
    const sy = cy - r * 2.5;
    const wake = clamp((score - 0.8) / 0.4);
    if (stage >= 3) {
      merged.current = lerp(merged.current, 1, 0.08);
    } else {
      merged.current = lerp(merged.current, 0, 0.12);
    }
    const m = merged.current;
    if (wake > 0) {
      const spin = still ? 0 : t * 0.4;
      const sr = r * 0.55 * wake;
      g.fillStyle = "rgba(255,229,138,0.95)";
      g.shadowColor = "rgba(255,207,92,0.9)";
      g.shadowBlur = 16;
      const a1 = lerp(lx, cx, m);
      const a2 = lerp(rx, cx, m);
      star(g, a1, sy, sr * (1 + m * 0.6), spin);
      g.fill();
      if (m < 0.98) {
        star(g, a2, sy, sr, -spin);
        g.fill();
      }
      if (stage >= 2 && m < 0.98) {
        g.shadowBlur = 0;
        g.strokeStyle = "rgba(255,229,138,0.6)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(lx, sy);
        g.lineTo(rx, sy);
        g.stroke();
      }
      g.shadowBlur = 0;
    }
    if (m > 0.5 && !still) {
      const ring = (t * 0.6) % 1;
      g.strokeStyle = `rgba(255,229,138,${(1 - ring) * 0.7})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, sy, r * (0.8 + ring * 2.8), 0, Math.PI * 2);
      g.stroke();
    }
  });

  // Dragging: grab either crystal and pull it toward the other.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const local = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hit = (x: number, y: number): "L" | "R" | null => {
      const { cx, h, r, maxGap, minGap } = geom.current;
      const gap = lerp(maxGap, minGap, clamp(view.current.closeness));
      const cy = h * 0.52;
      const reach = r * 1.9;
      if (Math.hypot(x - (cx + gap / 2), y - cy) < reach) return "R";
      if (Math.hypot(x - (cx - gap / 2), y - cy) < reach) return "L";
      return null;
    };
    const closenessAt = (x: number, side: "L" | "R") => {
      const { cx, maxGap, minGap } = geom.current;
      const gap = side === "R" ? 2 * (x - cx) : 2 * (cx - x);
      return clamp((maxGap - gap) / (maxGap - minGap));
    };
    const down = (e: PointerEvent) => {
      const p = local(e);
      const side = hit(p.x, p.y);
      if (!side) return;
      drag.current = side;
      wrap.setPointerCapture(e.pointerId);
      callbacks.current.onDragStart();
      callbacks.current.onDrag(closenessAt(p.x, side));
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (drag.current) {
        callbacks.current.onDrag(closenessAt(p.x, drag.current));
        markDirty();
      } else {
        wrap.style.cursor = hit(p.x, p.y) ? "grab" : "default";
      }
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      callbacks.current.onDragEnd();
    };
    wrap.addEventListener("pointerdown", down);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);
    return () => {
      wrap.removeEventListener("pointerdown", down);
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerup", up);
      wrap.removeEventListener("pointercancel", up);
    };
  }, [wrapRef, view, markDirty]);

  // The UI asks for a redraw when a slider or preset moves the crystals.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const host = wrap.parentElement ?? wrap;
    const on = () => markDirty();
    host.addEventListener("lab:view", on);
    return () => host.removeEventListener("lab:view", on);
  }, [wrapRef, markDirty]);

  return (
    <div ref={wrapRef} className={className} style={{ touchAction: "pan-y" }} aria-hidden="true">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
