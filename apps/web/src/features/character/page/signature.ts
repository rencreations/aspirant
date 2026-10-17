/**
 * Signature effects: one small 2D canvas toy per character, drawn over the hero art and taken
 * from her weapon or power (Fanny's cable, Layla's cannon, Ruby's scythe and so on). The
 * pointer aims; a click, tap or the signature line button fires. Decorative only.
 *
 * Pure canvas code with no React. The hero owns the loop and calls `step` each frame while
 * the hero is on screen; `step` returns false once nothing is moving, so the loop can sleep.
 */
import type { SignatureKind } from "../art";

export interface SignatureColours {
  readonly lead: string;
  readonly second: string;
  readonly glow: string;
}

export interface SignatureFx {
  move(x: number, y: number): void;
  fire(x: number, y: number): void;
  leave(): void;
  resize(w: number, h: number, dpr: number): void;
  /** Draw one frame. Returns true while anything is still animating. */
  step(dt: number, t: number): boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  colour: string;
  star: boolean;
  /** Pull toward a point (the orb) instead of flying free. */
  pull?: boolean;
}

interface Pulse {
  x: number;
  y: number;
  age: number;
  max: number;
  kind: "ring" | "hex" | "implode" | "beam" | "bolt" | "arc" | "flash";
  /** Extra data: beam start, bolt points, arc direction. */
  data?: number[];
}

const TAU = Math.PI * 2;

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const b = a + TAU / 8;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(b) * r * 0.22, Math.sin(b) * r * 0.22);
  }
  ctx.closePath();
  ctx.restore();
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function crescentPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5, false);
  ctx.arc(-r * 0.42, 0, r * 0.86, Math.PI * 0.42, -Math.PI * 0.42, true);
  ctx.closePath();
  ctx.restore();
}

/** A jagged bolt from (x0, y0) to (x1, y1), as flat [x, y, x, y ...]. */
function boltPoints(x0: number, y0: number, x1: number, y1: number, rand: () => number): number[] {
  const pts = [x0, y0];
  const steps = 12;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = (rand() - 0.5) * len * 0.12 * Math.sin(t * Math.PI);
    pts.push(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
  }
  pts.push(x1, y1);
  return pts;
}

export function createSignature(
  kind: SignatureKind,
  ctx: CanvasRenderingContext2D,
  colours: SignatureColours,
  light: boolean,
): SignatureFx {
  let w = 0;
  let h = 0;
  let dpr = 1;
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const pointer = { x: 0, y: 0, on: false };
  // A damped follower of the pointer (reticle, cable hook, orb, moons).
  const follow = { x: 0, y: 0, vx: 0, vy: 0 };
  const trail: Array<{ x: number; y: number; age: number }> = [];
  const sparks: Spark[] = [];
  const pulses: Pulse[] = [];
  const anchor = { x: 0, y: 0 };
  let spin = 0;
  let idle = 0;

  const add = (s: Spark) => {
    if (sparks.length < 160) sparks.push(s);
  };

  const burst = (x: number, y: number, n: number, speed: number, star: boolean) => {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU;
      const v = speed * (0.35 + rand() * 0.65);
      add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0,
        max: 0.6 + rand() * 0.7,
        size: star ? 5 + rand() * 9 : 1.2 + rand() * 2.2,
        colour: rand() < 0.5 ? colours.lead : colours.glow,
        star,
      });
    }
  };

  const fx: SignatureFx = {
    move(x, y) {
      if (!pointer.on) {
        follow.x = x;
        follow.y = y;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.on = true;
      idle = 0;
      trail.push({ x, y, age: 0 });
      if (trail.length > 24) trail.shift();
      if (kind === "stars" && rand() < 0.25) {
        add({
          x,
          y,
          vx: (rand() - 0.5) * 40,
          vy: 20 + rand() * 30,
          life: 0,
          max: 0.7,
          size: 3 + rand() * 4,
          colour: colours.lead,
          star: true,
        });
      }
    },
    fire(x, y) {
      pointer.x = x;
      pointer.y = y;
      switch (kind) {
        case "cable":
          anchor.x = follow.x;
          anchor.y = follow.y;
          burst(follow.x, follow.y, 14, 260, false);
          pulses.push({ x: follow.x, y: follow.y, age: 0, max: 0.5, kind: "ring" });
          break;
        case "beam":
          pulses.push({
            x,
            y,
            age: 0,
            max: 0.75,
            kind: "beam",
            data: [-20, y + (rand() - 0.5) * 60],
          });
          burst(x, y, 18, 320, false);
          break;
        case "scythe":
          pulses.push({ x, y, age: 0, max: 0.6, kind: "arc", data: [rand() < 0.5 ? 1 : -1] });
          burst(x, y, 10, 200, false);
          break;
        case "shield":
          for (let i = 0; i < 3; i++) pulses.push({ x, y, age: -i * 0.09, max: 0.9, kind: "hex" });
          break;
        case "reticle":
          pulses.push({ x, y, age: 0, max: 0.35, kind: "flash" });
          pulses.push({ x, y, age: 0, max: 0.6, kind: "ring" });
          burst(x, y, 8, 180, false);
          break;
        case "crescent":
          spin += Math.PI * 2;
          burst(x, y, 16, 220, true);
          break;
        case "stars":
          burst(x, y, 22, 380, true);
          pulses.push({ x, y, age: 0, max: 0.5, kind: "ring" });
          break;
        case "orb":
          pulses.push({ x, y, age: 0, max: 0.8, kind: "implode" });
          for (let i = 0; i < 26; i++) {
            const a = rand() * TAU;
            const r = 90 + rand() * 140;
            add({
              x: x + Math.cos(a) * r,
              y: y + Math.sin(a) * r,
              vx: -Math.sin(a) * 120,
              vy: Math.cos(a) * 120,
              life: 0,
              max: 1.1 + rand() * 0.5,
              size: 1.5 + rand() * 2,
              colour: rand() < 0.5 ? colours.lead : colours.second,
              star: false,
              pull: true,
            });
          }
          break;
        case "lightning":
          pulses.push({
            x,
            y,
            age: 0,
            max: 0.55,
            kind: "bolt",
            data: boltPoints(x + (rand() - 0.5) * w * 0.3, -10, x, y, rand),
          });
          pulses.push({ x, y, age: 0, max: 0.3, kind: "flash" });
          burst(x, y, 14, 300, false);
          break;
        case "moons":
          spin += Math.PI * 3;
          pulses.push({ x, y, age: 0, max: 0.6, kind: "ring" });
          burst(x, y, 12, 260, false);
          break;
      }
      idle = 0;
    },
    leave() {
      pointer.on = false;
    },
    resize(nw, nh, ndpr) {
      w = nw;
      h = nh;
      dpr = ndpr;
      if (!anchor.x && !anchor.y) {
        anchor.x = w * 0.06;
        anchor.y = -8;
      }
      if (!follow.x && !follow.y) {
        follow.x = w * 0.66;
        follow.y = h * 0.42;
      }
    },
    step(dt, t) {
      idle += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Damped follower (a critically damped spring).
      const k = kind === "reticle" ? 10 : kind === "cable" ? 14 : 8;
      const ax = (pointer.x - follow.x) * k * k - follow.vx * 2 * k;
      const ay = (pointer.y - follow.y) * k * k - follow.vy * 2 * k;
      follow.vx += ax * dt;
      follow.vy += ay * dt;
      follow.x += follow.vx * dt;
      follow.y += follow.vy * dt;
      spin *= Math.pow(0.04, dt);

      for (const p of trail) p.age += dt;
      while (trail.length && (trail[0]?.age ?? 0) > 0.35) trail.shift();

      const show = pointer.on ? 1 : Math.max(0, 1 - idle * 2);
      let busy = show > 0 || trail.length > 0;

      if (show > 0) {
        ctx.globalAlpha = show;
        drawIdle(t);
        ctx.globalAlpha = 1;
      }

      // Pulses.
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        if (!p) continue;
        p.age += dt;
        if (p.age >= p.max) {
          pulses.splice(i, 1);
          continue;
        }
        if (p.age < 0) continue;
        drawPulse(p, p.age / p.max);
        busy = true;
      }

      // Sparks.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        if (!s) continue;
        s.life += dt;
        if (s.life >= s.max) {
          sparks.splice(i, 1);
          continue;
        }
        if (s.pull) {
          const dx = pointer.x - s.x;
          const dy = pointer.y - s.y;
          s.vx += dx * 7 * dt;
          s.vy += dy * 7 * dt;
          s.vx *= Math.pow(0.2, dt);
          s.vy *= Math.pow(0.2, dt);
        } else {
          s.vx *= Math.pow(0.12, dt);
          s.vy = s.vy * Math.pow(0.12, dt) + 60 * dt;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const a = 1 - s.life / s.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.colour;
        if (s.star) {
          starPath(ctx, s.x, s.y, s.size * (0.6 + a * 0.4), s.life * 3);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, TAU);
          ctx.fill();
        }
        busy = true;
      }
      ctx.globalAlpha = 1;
      return busy || Math.abs(follow.vx) + Math.abs(follow.vy) > 2;
    },
  };

  function glowStroke(width: number, colour: string, core = true) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width * 3.2;
    ctx.globalAlpha *= 0.22;
    ctx.stroke();
    ctx.globalAlpha /= 0.22;
    ctx.lineWidth = width;
    ctx.stroke();
    if (core && !light) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, width * 0.4);
      ctx.stroke();
    }
  }

  function drawIdle(t: number) {
    const fx0 = follow.x;
    const fy0 = follow.y;
    switch (kind) {
      case "cable": {
        const dx = fx0 - anchor.x;
        const dy = fy0 - anchor.y;
        const len = Math.hypot(dx, dy);
        const sag = Math.min(120, len * 0.18);
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.quadraticCurveTo(anchor.x + dx * 0.5, anchor.y + dy * 0.5 + sag, fx0, fy0);
        glowStroke(1.6, colours.glow);
        ctx.fillStyle = colours.lead;
        starPath(ctx, fx0, fy0, 9, t * 2);
        ctx.fill();
        break;
      }
      case "beam": {
        ctx.beginPath();
        ctx.arc(fx0, fy0, 16 + Math.sin(t * 6) * 2, 0, TAU);
        glowStroke(1.4, colours.lead);
        ctx.beginPath();
        ctx.arc(fx0, fy0, 3, 0, TAU);
        ctx.fillStyle = colours.glow;
        ctx.fill();
        break;
      }
      case "scythe": {
        if (trail.length > 2) {
          ctx.beginPath();
          trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          glowStroke(2.4, colours.lead);
        }
        break;
      }
      case "shield": {
        for (let i = 0; i < 7; i++) {
          const a = (i / 6) * TAU;
          const r = i === 0 ? 0 : 34;
          const x = fx0 + Math.cos(a) * r;
          const y = fy0 + Math.sin(a) * r;
          hexPath(ctx, x, y, 19);
          ctx.globalAlpha = i === 0 ? 0.8 : 0.35;
          ctx.strokeStyle = colours.glow;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "reticle": {
        const r = 26;
        ctx.beginPath();
        ctx.arc(fx0, fy0, r, 0, TAU);
        ctx.moveTo(fx0 - r - 12, fy0);
        ctx.lineTo(fx0 - 8, fy0);
        ctx.moveTo(fx0 + 8, fy0);
        ctx.lineTo(fx0 + r + 12, fy0);
        ctx.moveTo(fx0, fy0 - r - 12);
        ctx.lineTo(fx0, fy0 - 8);
        ctx.moveTo(fx0, fy0 + 8);
        ctx.lineTo(fx0, fy0 + r + 12);
        glowStroke(1.2, colours.lead, false);
        ctx.fillStyle = colours.lead;
        ctx.font = "600 10px ui-monospace, monospace";
        ctx.fillText(
          `${String(Math.round(fx0)).padStart(4, "0")}:${String(Math.round(fy0)).padStart(4, "0")}`,
          fx0 + r + 6,
          fy0 - r,
        );
        break;
      }
      case "crescent": {
        const a = t * 1.4 + spin;
        const x = fx0 + Math.cos(a) * 30;
        const y = fy0 + Math.sin(a) * 30;
        crescentPath(ctx, x, y, 13, a + Math.PI);
        ctx.fillStyle = colours.lead;
        ctx.fill();
        ctx.fillStyle = colours.second;
        starPath(ctx, fx0, fy0, 5, t);
        ctx.fill();
        break;
      }
      case "stars": {
        ctx.fillStyle = colours.lead;
        starPath(ctx, fx0, fy0, 12, t * 1.5);
        ctx.fill();
        break;
      }
      case "orb": {
        const r = 14 + Math.sin(t * 3) * 1.5;
        const g = ctx.createRadialGradient(fx0, fy0, r * 0.4, fx0, fy0, r * 2.4);
        g.addColorStop(0, colours.second);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.arc(fx0, fy0, r * 2.4, 0, TAU);
        ctx.fill();
        ctx.globalAlpha /= 0.55;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#07040f";
        ctx.beginPath();
        ctx.arc(fx0, fy0, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = colours.lead;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.globalCompositeOperation = light ? "source-over" : "lighter";
        break;
      }
      case "lightning": {
        if (Math.sin(t * 11) > 0.93) {
          const a = rand() * TAU;
          const pts = boltPoints(fx0, fy0, fx0 + Math.cos(a) * 46, fy0 + Math.sin(a) * 46, rand);
          ctx.beginPath();
          for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
          glowStroke(1.2, colours.glow);
        }
        ctx.beginPath();
        ctx.arc(fx0, fy0, 5, 0, TAU);
        ctx.fillStyle = colours.lead;
        ctx.fill();
        break;
      }
      case "moons": {
        for (let i = 0; i < 2; i++) {
          const a = t * 2.2 + spin + i * Math.PI;
          const r = 38 + Math.sin(spin) * 40;
          const x = fx0 + Math.cos(a) * r;
          const y = fy0 + Math.sin(a) * r * 0.55;
          crescentPath(ctx, x, y, 12, a + Math.PI / 2);
          ctx.fillStyle = i ? colours.glow : colours.lead;
          ctx.fill();
        }
        break;
      }
    }
  }

  function drawPulse(p: Pulse, k: number) {
    const ease = 1 - (1 - k) * (1 - k);
    const fade = 1 - k;
    ctx.globalAlpha = fade;
    switch (p.kind) {
      case "ring": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + ease * 70, 0, TAU);
        glowStroke(1.5, colours.lead, false);
        break;
      }
      case "flash": {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 120);
        g.addColorStop(0, colours.glow);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 120, 0, TAU);
        ctx.fill();
        break;
      }
      case "hex": {
        hexPath(ctx, p.x, p.y, 20 + ease * 120);
        glowStroke(2, colours.glow, false);
        break;
      }
      case "implode": {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 - ease) * 160 + 4, 0, TAU);
        glowStroke(1.6, colours.second, false);
        break;
      }
      case "beam": {
        const x0 = p.data?.[0] ?? 0;
        const y0 = p.data?.[1] ?? p.y;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(p.x, p.y);
        glowStroke(10 * fade + 1, colours.glow);
        break;
      }
      case "bolt": {
        const pts = p.data ?? [];
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
        glowStroke(2.2, colours.glow);
        break;
      }
      case "arc": {
        const dir = p.data?.[0] ?? 1;
        const start = -Math.PI * 0.85 * dir;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 90, start, start + dir * ease * Math.PI * 1.3, dir < 0);
        glowStroke(4 * fade + 1, colours.lead);
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  return fx;
}
