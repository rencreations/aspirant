import { LEAN, SLASH } from "./layout";

/**
 * The red energy slash between Obsidia and Selena, as shapes in board units. It is made once, from
 * a fixed seed, so the server and the browser draw the same one. It is a ribbon down the slanted
 * line between the two panels: thin at the top, wide and torn in the lower half, with a lighter
 * body inside the dark one and a white core inside that, dark cracks across it and white
 * hairlines along its torn edges. Nothing here moves: the page pulses a copy of the bright parts.
 */

/** The ribbon runs from this height to this one, past the panels at both ends. */
export const SLASH_FROM = -112;
export const SLASH_TO = 512;

/** A small seeded generator, so the slash is the same on every build. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The middle of the ribbon at a height. */
const centre = (y: number) => SLASH.x - LEAN * (y - SLASH.y);

/** Half of how wide the ribbon is at a height. */
function half(y: number) {
  const t = (y - SLASH_FROM) / (SLASH_TO - SLASH_FROM);
  const swell = smooth(0.28, 0.62, t) * (1 - smooth(0.86, 1, t));
  const ripple = 0.8 + 0.2 * Math.sin(t * 19.5 + 1.3) + 0.12 * Math.sin(t * 47);
  return (4.2 + 14 * swell) * ripple;
}

type P = readonly [number, number];
const f = (n: number) => n.toFixed(1);
const path = (pts: readonly P[], close = false) =>
  `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}${close ? "Z" : ""}`;

/** A torn ribbon: both edges as points, from the top down and from the bottom up. */
function ribbon(rand: () => number, scale: number, tear: number, step: number) {
  const left: P[] = [];
  const right: P[] = [];
  let y = SLASH_FROM;
  let flip = false;
  while (y < SLASH_TO) {
    const w = half(y) * scale;
    // Every other point is pushed out, so the edge reads as a tear and not as a wave.
    const out = flip ? 1 + tear * (0.4 + rand()) : 1 - tear * 0.5 * rand();
    const spike = rand() < 0.07 ? 1 + tear * 2.2 * rand() : 1;
    const c = centre(y) + (rand() - 0.5) * tear * 3;
    left.push([c - w * out * (rand() < 0.5 ? spike : 1), y]);
    right.push([c + w * (flip ? 1 - tear * 0.5 * rand() : 1 + tear * (0.4 + rand())) * spike, y]);
    flip = !flip;
    y += step * (0.55 + rand() * 0.9);
  }
  return { left, right, pts: [...left, ...[...right].reverse()] };
}

/** A crack: a few short segments that wander away from a start point. */
function crack(rand: () => number, y: number, spread: number): P[] {
  const dir = rand() < 0.5 ? -1 : 1;
  const out: P[] = [[centre(y) + (rand() - 0.5) * spread * 0.6, y]];
  const n = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const [px, py] = out[out.length - 1]!;
    out.push([px + dir * (2 + rand() * 5.5), py + (rand() - 0.15) * 9]);
  }
  return out;
}

function build() {
  const rand = seeded(20261030);
  const halo = ribbon(rand, 2.5, 0.05, 11);
  const body = ribbon(rand, 1, 0.55, 5.5);
  const mid = ribbon(rand, 0.62, 0.4, 6.5);
  const core = ribbon(rand, 0.24, 0.3, 5);

  // The cracks: dark ones inside the body, and a few thin bright ones.
  let dark = "";
  for (let y = SLASH_FROM + 30; y < SLASH_TO - 20; y += 6 + rand() * 9) {
    const t = (y - SLASH_FROM) / (SLASH_TO - SLASH_FROM);
    if (rand() < 0.28 + 0.6 * smooth(0.25, 0.6, t)) dark += path(crack(rand, y, half(y)));
  }
  let bright = "";
  for (let y = SLASH_FROM + 60; y < SLASH_TO - 40; y += 18 + rand() * 20) {
    bright += path(crack(rand, y, half(y) * 0.5));
  }

  // The white edge: the torn edges of the body, in short runs, so it breaks up like lightning.
  let edge = "";
  for (const side of [body.left, body.right]) {
    let run: P[] = [];
    side.forEach((p, i) => {
      run.push(p);
      if (run.length >= 3 + (i % 4)) {
        edge += path(run);
        run = [p];
      }
    });
    if (run.length > 1) edge += path(run);
  }

  // Thin shards that stand out of the edge at the wide part.
  let shards = "";
  for (let y = 40; y < 430; y += 14 + rand() * 24) {
    const side = rand() < 0.5 ? -1 : 1;
    const x = centre(y) + side * (half(y) * (0.9 + rand() * 0.5));
    const len = 5 + rand() * 11;
    shards += path(
      [
        [x, y],
        [x + side * len, y - 2 - rand() * 5],
        [x + side * (len * 0.3), y + 2.6],
      ],
      true,
    );
  }

  return {
    halo: path(halo.pts, true),
    body: path(body.pts, true),
    mid: path(mid.pts, true),
    core: path(core.pts, true),
    cracks: dark,
    sparks: bright,
    edge,
    shards,
    /** The centre line, a white zigzag down the core. */
    zigzag: path(
      core.left.map((p, k) => {
        const q = core.right[k] ?? p;
        const jitter = (k % 2 === 0 ? -1 : 1) * (0.4 + rand() * 1.6);
        return [(p[0] + q[0]) / 2 + jitter, p[1]] as P;
      }),
    ),
  };
}

export const SLASH_ART = build();
