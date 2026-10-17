/**
 * Small canvas scenes for the before and after tracks. Every "calm" scene is pale and warm so
 * dark text sits on it; `d` (0 to 1) drains the colour as the line is struck out. The "storm"
 * scene is the other world: black, with rifts and rising embers.
 */
import { clamp, mulberry32, smoothstep } from "@/lib/math";

export type CalmMode = "skyline" | "lanterns" | "lamps" | "sky" | "morning";
export type StormTone = "violet" | "amber";

type RGB = readonly [number, number, number];

const GREY: RGB = [186, 190, 198];

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: RGB, a = 1): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
}

function drain(c: RGB, d: number): RGB {
  return mix(c, GREY, d * 0.92);
}

function skyGradient(
  g: CanvasRenderingContext2D,
  h: number,
  stops: Array<[number, RGB]>,
  d: number,
) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [at, c] of stops) grad.addColorStop(at, rgba(drain(c, d)));
  g.fillStyle = grad;
}

// Deterministic scatter, so a resize never reshuffles a scene.
const R = mulberry32(978);
const rnd = (n: number) => Array.from({ length: n }, () => R());
const TOWERS = rnd(26).map((v, i) => ({
  x: i / 26,
  w: 0.018 + v * 0.03,
  h: 0.18 + ((v * 7) % 1) * 0.36,
}));
const FLYERS = rnd(10);
const LANTERNS = rnd(40).map((v, i) => ({
  x: v,
  z: ((i * 37) % 40) / 40,
  s: 0.6 + ((v * 13) % 1) * 0.8,
  rise: i % 4 === 0,
  p: (v * 29) % 1,
}));
const LAMPS = rnd(21);
const CLOUDS = rnd(8);
const MOTES = rnd(48);

function skyline(g: CanvasRenderingContext2D, w: number, h: number, t: number, d: number) {
  skyGradient(
    g,
    h * 0.84,
    [
      [0, [138, 190, 238]],
      [0.55, [200, 226, 246]],
      [1, [255, 226, 176]],
    ],
    d,
  );
  g.fillRect(0, 0, w, h);
  const sun = drain([255, 236, 190], d * 0.8);
  const sg = g.createRadialGradient(w * 0.74, h * 0.56, 0, w * 0.74, h * 0.56, h * 0.5);
  sg.addColorStop(0, rgba(sun, 0.95));
  sg.addColorStop(0.2, rgba(sun, 0.4));
  sg.addColorStop(1, rgba(sun, 0));
  g.fillStyle = sg;
  g.fillRect(0, 0, w, h);

  // Two rows of towers.
  for (let row = 0; row < 2; row++) {
    g.fillStyle = rgba(drain(row ? [96, 130, 176] : [150, 176, 210], d), row ? 0.85 : 0.7);
    for (const tw of TOWERS) {
      const bw = tw.w * w * (row ? 1.2 : 0.9);
      const bh = tw.h * h * (row ? 1 : 0.7);
      const bx = ((tw.x + (row ? 0.013 : 0)) % 1) * w;
      g.fillRect(bx, h - bh, bw, bh);
      if (tw.h > 0.4) g.fillRect(bx + bw * 0.45, h - bh - h * 0.05, 2, h * 0.05);
    }
  }
  // Flying machines drifting across.
  for (let i = 0; i < FLYERS.length; i++) {
    const f = FLYERS[i] ?? 0;
    const x = (((f + t * 0.01 * (1 + (i % 3))) % 1.2) - 0.1) * w;
    const y = h * (0.14 + f * 0.36) + Math.sin(t * 0.8 + i) * 4;
    g.fillStyle = rgba(drain([70, 90, 130], d), 0.8);
    g.beginPath();
    g.ellipse(x, y, 9, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rgba(drain([255, 180, 90], d), 0.9);
    g.fillRect(x + 8, y - 1, 2, 2);
  }
}

function lanterns(g: CanvasRenderingContext2D, w: number, h: number, t: number, d: number) {
  const horizon = h * 0.5;
  skyGradient(
    g,
    horizon,
    [
      [0, [250, 218, 200]],
      [1, [255, 236, 196]],
    ],
    d,
  );
  g.fillRect(0, 0, w, horizon);
  skyGradient(
    g,
    h,
    [
      [0, [170, 206, 232]],
      [0.5, [170, 206, 232]],
      [1, [120, 160, 204]],
    ],
    d,
  );
  g.fillRect(0, horizon, w, h - horizon);

  for (const L of LANTERNS) {
    const size = (10 + L.z * 26) * L.s;
    let x = ((((L.x + t * 0.004 * (0.4 + L.z)) % 1) + 1) % 1) * w;
    let y = horizon + 14 + L.z * (h - horizon - 40);
    let alpha = 1;
    if (L.rise) {
      const k = (L.p + t * 0.012 * L.s) % 1;
      y = horizon - 6 - k * horizon * 0.85;
      x += Math.sin(t * 0.7 + L.p * 9) * 12;
      alpha = 1 - smoothstep(0.55, 1, k);
    } else {
      y += Math.sin(t * 0.9 + L.p * 12) * 2;
    }
    const glow = (1 - d) * alpha;
    const body = drain([255, 170, 70], d);
    // Reflection on the water, then the glow, then the paper body.
    if (!L.rise) {
      g.fillStyle = rgba(body, 0.18 * glow);
      g.fillRect(x - size * 0.35, y + size * 0.9, size * 0.7, size * 1.6);
    }
    const halo = g.createRadialGradient(x, y, 0, x, y, size * 2.6);
    halo.addColorStop(0, rgba(drain([255, 200, 110], d), 0.5 * glow));
    halo.addColorStop(1, rgba(drain([255, 200, 110], d), 0));
    g.fillStyle = halo;
    g.fillRect(x - size * 2.6, y - size * 2.6, size * 5.2, size * 5.2);
    g.fillStyle = rgba(body, alpha);
    g.fillRect(x - size * 0.4, y - size * 0.55, size * 0.8, size * 1.1);
    g.fillStyle = rgba(drain([255, 244, 214], d), 0.85 * alpha);
    g.fillRect(x - size * 0.22, y - size * 0.35, size * 0.44, size * 0.7);
  }
}

function lamps(g: CanvasRenderingContext2D, w: number, h: number, t: number, d: number) {
  skyGradient(
    g,
    h,
    [
      [0, [255, 238, 200]],
      [1, [250, 214, 150]],
    ],
    d,
  );
  g.fillRect(0, 0, w, h);

  // The dome: glass ribs over the city.
  g.strokeStyle = rgba(drain([255, 255, 255], d), 0.75);
  g.lineWidth = 1.2;
  const cx = w / 2;
  const cy = h * 1.05;
  const rx = w * 0.6;
  const ry = h * 0.9;
  for (let i = -4; i <= 4; i++) {
    g.beginPath();
    g.ellipse(cx, cy, rx * (Math.abs(i) / 4 || 0.02), ry, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
  g.lineWidth = 2.2;
  g.stroke();

  // Amber lamps round the rim, dying one by one as d rises.
  LAMPS.forEach((v, i) => {
    const a = Math.PI + (Math.PI * (i + 0.5)) / LAMPS.length;
    const lx = cx + Math.cos(a) * rx * 0.97;
    const ly = cy + Math.sin(a) * ry * 0.97;
    const on = 1 - smoothstep(0.05 + v * 0.7, 0.2 + v * 0.7, d);
    const flick = reduced0(t) ? 1 : 0.88 + 0.12 * Math.sin(t * 3 + i * 2.1);
    const cone = g.createLinearGradient(lx, ly, lx, h);
    cone.addColorStop(0, rgba([255, 190, 80], 0.42 * on * flick));
    cone.addColorStop(1, rgba([255, 190, 80], 0));
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(lx - 4, ly);
    g.lineTo(lx + 4, ly);
    g.lineTo(lx + 70 + (lx - cx) * 0.12, h);
    g.lineTo(lx - 70 + (lx - cx) * 0.12, h);
    g.closePath();
    g.fill();
    const halo = g.createRadialGradient(lx, ly, 0, lx, ly, 34);
    halo.addColorStop(0, rgba([255, 196, 90], 0.85 * on * flick));
    halo.addColorStop(1, rgba([255, 196, 90], 0));
    g.fillStyle = halo;
    g.fillRect(lx - 34, ly - 34, 68, 68);
    g.fillStyle = rgba(on > 0.5 ? [255, 168, 50] : drain([150, 140, 130], 1), 1);
    g.beginPath();
    g.arc(lx, ly, 4.2, 0, Math.PI * 2);
    g.fill();
  });

  // Golden towers below.
  g.fillStyle = rgba(drain([226, 170, 92], d), 0.9);
  for (const tw of TOWERS) {
    g.fillRect(tw.x * w, h - tw.h * h * 0.6, tw.w * w, tw.h * h * 0.6);
  }
}

/** Static scenes need no wall clock; a still frame passes t = 0. */
function reduced0(t: number): boolean {
  return t === 0;
}

function sky(g: CanvasRenderingContext2D, w: number, h: number, t: number, d: number) {
  const top = mix([120, 184, 240], [168, 132, 98], d);
  const bottom = mix([214, 236, 252], [206, 170, 130], d);
  const grad = g.createLinearGradient(0, 0, 0, h * 0.78);
  grad.addColorStop(0, rgba(top));
  grad.addColorStop(1, rgba(bottom));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  for (let i = 0; i < CLOUDS.length; i++) {
    const v = CLOUDS[i] ?? 0;
    const x = (((v + t * 0.006 * (0.5 + v)) % 1.3) - 0.15) * w;
    const y = h * (0.1 + (i % 4) * 0.12);
    g.fillStyle = rgba(mix([255, 255, 255], [150, 120, 92], d), 0.85 - d * 0.3);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.ellipse(x + k * 34, y + (k % 2) * 6, 44 - k * 4, 14 - k, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Sea, hills and forest.
  g.fillStyle = rgba(mix([70, 156, 212], [128, 104, 74], d));
  g.fillRect(0, h * 0.76, w, h * 0.24);
  for (let layer = 0; layer < 2; layer++) {
    g.fillStyle = rgba(
      mix(layer ? [38, 122, 74] : [72, 160, 104], layer ? [96, 74, 48] : [128, 98, 64], d),
    );
    g.beginPath();
    g.moveTo(0, h * 0.8);
    for (let x = 0; x <= w; x += 10) {
      g.lineTo(x, h * (0.7 + layer * 0.06) - Math.sin(x / (w * 0.12) + layer * 2) * h * 0.04);
    }
    g.lineTo(w, h * 0.8);
    g.closePath();
    g.fill();
  }
  g.fillStyle = rgba([150, 110, 70], d * 0.42);
  g.fillRect(0, 0, w, h);
}

function morning(g: CanvasRenderingContext2D, w: number, h: number, t: number, d: number) {
  skyGradient(
    g,
    h,
    [
      [0, [255, 246, 214]],
      [1, [236, 246, 255]],
    ],
    d,
  );
  g.fillRect(0, 0, w, h);
  const cx = w * 0.7;
  const cy = h * 0.5;
  const r = h * 0.13;
  const sun = g.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
  sun.addColorStop(0, rgba(drain([255, 214, 110], d), 0.9 * (1 - d * 0.5)));
  sun.addColorStop(0.35, rgba(drain([255, 214, 110], d), 0.3));
  sun.addColorStop(1, rgba(drain([255, 214, 110], d), 0));
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  // Hexagon rings of the Sphere around the sun; they fall away as d rises.
  for (let ring = 1; ring <= 5; ring++) {
    g.strokeStyle = rgba(drain([0, 140, 170], d), 0.28 * (1 - d * 0.7));
    g.lineWidth = 1;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + t * 0.03 * (ring % 2 ? 1 : -1);
      const rr = r * (1 + ring * 0.9);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.stroke();
  }
  g.fillStyle = rgba(drain([255, 190, 80], d), 1);
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < MOTES.length; i++) {
    const v = MOTES[i] ?? 0;
    const x = v * w + Math.sin(t * 0.5 + i) * 10;
    const y = h - ((v * 7 + t * 0.02 * (0.5 + (i % 5) * 0.2)) % 1) * h;
    g.fillStyle = rgba(drain([255, 200, 90], d), 0.6 * (1 - d));
    g.fillRect(x, y, 2.2, 2.2);
  }
}

const SCENES: Record<
  CalmMode,
  (g: CanvasRenderingContext2D, w: number, h: number, t: number, d: number) => void
> = { skyline, lanterns, lamps, sky, morning };

/** Draw one calm scene. `p` is the track progress, 0 to 1. */
export function drawCalm(
  g: CanvasRenderingContext2D,
  mode: CalmMode,
  w: number,
  h: number,
  t: number,
  p: number,
): void {
  SCENES[mode](g, w, h, t, clamp((p - 0.26) / 0.3));
}

// ---------------------------------------------------------------------------------------

const RIFT = (() => {
  const rand = mulberry32(9);
  const branches: Array<Array<[number, number]>> = [];
  for (let b = 0; b < 7; b++) {
    const pts: Array<[number, number]> = [[0.5 + (rand() - 0.5) * 0.3, -0.02]];
    let x = pts[0]?.[0] ?? 0.5;
    let y = 0;
    for (let s = 0; s < 8; s++) {
      x += (rand() - 0.5) * 0.18;
      y += 0.09 + rand() * 0.1;
      pts.push([x, y]);
    }
    branches.push(pts);
  }
  return branches;
})();
const EMBERS = rnd(70);

/** The Storm world: void black, a rift from the top, embers rising. */
export function drawStorm(
  g: CanvasRenderingContext2D,
  tone: StormTone,
  w: number,
  h: number,
  t: number,
): void {
  const hot: RGB = tone === "amber" ? [255, 162, 74] : [181, 156, 255];
  const alt: RGB = tone === "amber" ? [255, 207, 92] : [255, 84, 104];
  const bg = g.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, h * 1.1);
  bg.addColorStop(0, rgba(mix([10, 14, 24], hot, 0.22)));
  bg.addColorStop(1, "rgba(5,7,12,1)");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  g.lineJoin = "round";
  RIFT.forEach((pts, b) => {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jitter = Math.sin(t * 2 + b + i) * 1.4;
      if (i === 0) g.moveTo(x * w, y * h);
      else g.lineTo(x * w + jitter, y * h);
    });
    g.strokeStyle = rgba(hot, 0.16);
    g.lineWidth = 7;
    g.stroke();
    g.strokeStyle = rgba(b % 2 ? alt : hot, 0.85);
    g.lineWidth = 1.2;
    g.stroke();
  });

  for (let i = 0; i < EMBERS.length; i++) {
    const v = EMBERS[i] ?? 0;
    const x = v * w + Math.sin(t * 0.6 + i * 3) * 14;
    const k = (v * 11 + t * 0.03 * (0.6 + (i % 6) * 0.25)) % 1;
    const y = h * (1.05 - k * 1.1);
    g.fillStyle = rgba(i % 3 ? hot : alt, 0.8 * (1 - k));
    g.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
  }
}
