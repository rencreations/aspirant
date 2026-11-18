import { TAU, hash01, hashRange, hashSigned } from "./math";
import type { AnchorRef, Mark, MarkPool } from "./mark";
import { PRIM, type MarkKind } from "./kinds";
import { writeColor } from "./palette";

/**
 * One call of `emit` (or one beat of a `sustain`), resolved: every option has a value. The system
 * keeps one of these and reuses it, so a call allocates nothing.
 */
export class Spawn {
  kind: MarkKind = "bang";
  pool: MarkPool;
  ref: AnchorRef | null = null;
  bx = 0;
  by = 0;
  size = 60;
  /** Seconds the main part lives. */
  duration = 1;
  count = 1;
  seed = 1;
  delay = 0;
  /** The tilt of the whole mark, or the direction of a streak (0 is right, a quarter turn is up). */
  rot = 0;
  hasRot = false;
  fill = new Float32Array(3);
  accent = new Float32Array(3);
  /** The caller gave no colour: a recipe may mix its own (the stars, the notes). */
  mixed = true;

  constructor(pool: MarkPool) {
    this.pool = pool;
  }
}

const CYCLE = new Float32Array(9);
writeColor("gold", CYCLE, 0);
writeColor("pink", CYCLE, 3);
writeColor("white", CYCLE, 6);
const NOTE_CYCLE = new Float32Array(9);
writeColor("pink", NOTE_CYCLE, 0);
writeColor("gold", NOTE_CYCLE, 3);
writeColor("white", NOTE_CYCLE, 6);

/** A fresh mark with what every part shares: where it stands, its colours, its seed. */
function put(s: Spawn, layer: 0 | 1 | 2, prim: number, size: number, k: number): Mark {
  const m = s.pool.acquire(layer);
  m.ref = s.ref;
  m.bx = s.bx;
  m.by = s.by;
  m.prim = prim;
  m.size = size;
  m.seed = (s.seed * 131 + k * 17) | 0;
  m.fr = s.fill[0]!;
  m.fg = s.fill[1]!;
  m.fb = s.fill[2]!;
  m.ar = s.accent[0]!;
  m.ag = s.accent[1]!;
  m.ab = s.accent[2]!;
  m.life = s.duration;
  m.age = -s.delay;
  m.rot = s.rot;
  return m;
}

function cycle(m: Mark, table: Float32Array, i: number): void {
  const at = (i % 3) * 3;
  m.fr = table[at]!;
  m.fg = table[at + 1]!;
  m.fb = table[at + 2]!;
}

/** The tilt of a whole mark: the caller's, or a small one from the seed so repeats do not match. */
function tilt(s: Spawn, k: number, amount = 0.14): number {
  return s.hasRot ? s.rot : hashSigned(s.seed, 900 + k) * amount;
}

function bang(s: Spawn): void {
  const m = put(s, 2, PRIM.bang, s.size, 0);
  m.rot = tilt(s, 0);
  m.popT = 0.17;
  m.overshoot = 2.1;
  m.squash = 0.28;
  m.fadeT = 0.3;
  m.wobble = 0.035;
  m.wobbleHz = 7;
  m.vy = 16;
  m.drag = 2;
}

function question(s: Spawn): void {
  const m = put(s, 2, PRIM.question, s.size, 0);
  m.rot = tilt(s, 0, 0.1);
  m.popT = 0.2;
  m.overshoot = 2;
  m.squash = 0.24;
  m.fadeT = 0.35;
  m.wobble = 0.1;
  m.wobbleHz = 2.4;
  m.vy = 10;
  m.drag = 1.5;
}

function sweat(s: Spawn): void {
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 1, PRIM.drop, s.size, i);
    m.ox = (i - (s.count - 1) / 2) * s.size * 1.7;
    m.oy = hashSigned(s.seed, i) * s.size * 0.2;
    m.rot = tilt(s, i, 0.2);
    m.age = -(s.delay + i * 0.12);
    m.popT = 0.12;
    m.overshoot = 2;
    m.squash = 0.22;
    m.vy = -s.size * 0.5;
    m.gy = -s.size * 5;
    m.fadeT = 0.3;
  }
}

function vein(s: Spawn): void {
  const m = put(s, 2, PRIM.vein, s.size, 0);
  m.rot = tilt(s, 0, 0.18);
  m.popT = 0.14;
  m.overshoot = 2.2;
  m.squash = 0.2;
  m.throb = 0.09;
  m.throbHz = 6;
  m.wobble = 0.05;
  m.wobbleHz = 9;
  m.fadeT = 0.3;
}

function annoyed(s: Spawn): void {
  vein(s);
  for (let side = -1; side <= 1; side += 2) {
    const m = put(s, 0, PRIM.puff, s.size * 0.5, 10 + side);
    m.param = 5;
    m.fr = m.fg = m.fb = 0.953;
    m.ox = side * s.size * 0.72;
    m.oy = s.size * 0.08;
    m.vx = side * s.size * 0.4;
    m.vy = s.size * 0.7;
    m.drag = 1.2;
    m.grow = 0.5;
    m.age = -(s.delay + 0.1);
    m.life = s.duration * 0.8;
    m.popT = 0.16;
    m.overshoot = 1.3;
    m.fadeT = 0.4;
  }
}

function spark(s: Spawn): void {
  const n = s.count;
  const base = s.hasRot ? s.rot : hash01(s.seed, 7) * TAU;
  for (let i = 0; i < n; i++) {
    const m = put(s, 1, PRIM.streak, s.size * 0.24, i);
    const a = base + (i / n) * TAU + hashSigned(s.seed, i) * 0.22;
    const speed = s.size * hashRange(s.seed, 40 + i, 2.4, 3.6);
    m.aspect = 2.3;
    m.param = 0.62;
    m.outline = 1.8;
    m.rot = a;
    m.ox = Math.cos(a) * s.size * 0.12;
    m.oy = Math.sin(a) * s.size * 0.12;
    m.vx = Math.cos(a) * speed;
    m.vy = Math.sin(a) * speed;
    m.drag = 3.4;
    m.life = s.duration * hashRange(s.seed, 80 + i, 0.8, 1);
    m.popT = 0.05;
    m.overshoot = 0;
    m.squash = 0;
    m.fadeT = 0.22;
  }
}

function starburst(s: Spawn): void {
  const n = s.count;
  const base = s.hasRot ? s.rot : hash01(s.seed, 7) * TAU;
  for (let i = 0; i < n; i++) {
    const m = put(s, 1, PRIM.star, s.size * hashRange(s.seed, 20 + i, 0.22, 0.34), i);
    const a = base + (i / n) * TAU + hashSigned(s.seed, i) * 0.3;
    const speed = s.size * hashRange(s.seed, 40 + i, 1.5, 2.6);
    if (s.mixed) cycle(m, CYCLE, i);
    m.rot = hashSigned(s.seed, 60 + i) * 0.6;
    m.spin = hashSigned(s.seed, 70 + i) * 5;
    m.vx = Math.cos(a) * speed;
    m.vy = Math.sin(a) * speed;
    m.gy = -s.size * 0.9;
    m.drag = 2.2;
    m.life = s.duration * hashRange(s.seed, 80 + i, 0.8, 1.05);
    m.popT = 0.1;
    m.overshoot = 1.8;
    m.squash = 0.15;
    m.fadeT = 0.32;
  }
}

function dizzy(s: Spawn): void {
  const n = Math.max(2, s.count > 1 ? s.count : 4);
  const phase = hash01(s.seed, 3) * TAU;
  for (let i = 0; i < n; i++) {
    const m = put(s, 1, PRIM.star, s.size * 0.3, i);
    m.orbit = true;
    m.orbPhase = phase + (i / n) * TAU;
    m.orbSpeed = 4.2;
    m.orbRx = s.size * 0.52;
    m.orbRy = s.size * 0.17;
    m.depth = 0.22;
    m.spin = 2.5;
    m.age = -(s.delay + i * 0.05);
    m.popT = 0.15;
    m.overshoot = 1.8;
    m.squash = 0.1;
    m.fadeT = 0.3;
  }
}

function sparkle(s: Spawn): void {
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 1, PRIM.sparkle, s.size * hashRange(s.seed, i, 0.8, 1.2), i);
    if (s.count > 1) {
      const a = hash01(s.seed, 30 + i) * TAU;
      const r = s.size * hashRange(s.seed, 50 + i, 0.3, 0.9);
      m.ox = Math.cos(a) * r;
      m.oy = Math.sin(a) * r;
    }
    m.age = -(s.delay + i * 0.12);
    m.spin = hashSigned(s.seed, 60 + i) * 0.9;
    m.throb = 0.22;
    m.throbHz = 3.2;
    m.popT = 0.2;
    m.overshoot = 1.7;
    m.squash = 0;
    m.fadeT = 0.35;
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1.1);
  }
}

function heart(s: Spawn): void {
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 1, PRIM.heart, s.size * hashRange(s.seed, i, 0.85, 1.15), i);
    m.ox = s.count > 1 ? hashSigned(s.seed, 20 + i) * s.size * 0.45 : 0;
    m.rot = tilt(s, i, 0.25);
    m.age = -(s.delay + i * 0.28);
    m.vy = s.size * 1.4;
    m.drag = 0.6;
    m.sway = s.size * 0.18;
    m.swayHz = 1.5;
    m.swayPhase = hash01(s.seed, 40 + i) * TAU;
    m.popT = 0.22;
    m.overshoot = 1.8;
    m.squash = 0.2;
    m.throb = 0.06;
    m.throbHz = 4;
    m.fadeT = 0.4;
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.9, 1.1);
  }
}

function note(s: Spawn): void {
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 1, PRIM.note, s.size * hashRange(s.seed, i, 0.85, 1.15), i);
    m.variant = Math.floor(hash01(s.seed, 10 + i) * 4);
    if (s.mixed) cycle(m, NOTE_CYCLE, Math.floor(hash01(s.seed, 12 + i) * 3));
    m.ox = s.count > 1 ? hashSigned(s.seed, 20 + i) * s.size * 0.5 : 0;
    m.rot = hashSigned(s.seed, 30 + i) * 0.25;
    m.age = -(s.delay + i * 0.22);
    m.vy = s.size * 1.5;
    m.drag = 0.5;
    m.sway = s.size * 0.35;
    m.swayHz = 1.2;
    m.swayPhase = hash01(s.seed, 40 + i) * TAU;
    m.wobble = 0.22;
    m.wobbleHz = 1.4;
    m.popT = 0.18;
    m.overshoot = 1.8;
    m.squash = 0.2;
    m.fadeT = 0.5;
  }
}

function dust(s: Spawn): void {
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 0, PRIM.puff, s.size * hashRange(s.seed, i, 0.5, 1), i);
    m.param = 5;
    m.vx = hashSigned(s.seed, 20 + i) * s.size * 1.6;
    m.vy = s.size * hashRange(s.seed, 30 + i, 0.2, 0.9);
    m.drag = 3;
    m.grow = 0.7;
    m.age = -(s.delay + i * 0.04);
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1.1);
    m.popT = 0.09;
    m.overshoot = 1.2;
    m.squash = 0.1;
    m.fadeT = 0.35;
  }
}

function zzz(s: Spawn): void {
  const sizes = [0.55, 0.75, 1];
  for (let i = 0; i < 3; i++) {
    const m = put(s, 1, PRIM.zed, s.size * sizes[i]!, i);
    m.ox = i * s.size * 0.45;
    m.oy = i * s.size * 0.5;
    m.rot = -0.12 + hashSigned(s.seed, i) * 0.08;
    m.age = -(s.delay + i * 0.38);
    m.vy = s.size * 0.4;
    m.sway = s.size * 0.12;
    m.swayHz = 1.1;
    m.swayPhase = hash01(s.seed, 40 + i) * TAU;
    m.wobble = 0.15;
    m.wobbleHz = 1.1;
    m.popT = 0.2;
    m.overshoot = 1.6;
    m.squash = 0.15;
    m.fadeT = 0.5;
  }
}

function speed(s: Spawn): void {
  const n = s.count;
  const dx = Math.cos(s.rot);
  const dy = Math.sin(s.rot);
  for (let i = 0; i < n; i++) {
    const u = s.size * 0.16;
    const len = s.size * hashRange(s.seed, i, 1.2, 2.4);
    const m = put(s, 0, PRIM.streak, u, i);
    const lateral = (i - (n - 1) / 2) * s.size * 0.26 + hashSigned(s.seed, 20 + i) * s.size * 0.06;
    const along = hashRange(s.seed, 30 + i, 0, s.size * 0.3);
    m.aspect = len / u;
    m.param = 0.5;
    m.outline = 1.5;
    m.ox = -dy * lateral - dx * along;
    m.oy = dx * lateral - dy * along;
    m.vx = -dx * s.size * 1.2;
    m.vy = -dy * s.size * 1.2;
    m.age = -(s.delay + hash01(s.seed, 50 + i) * 0.05);
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1.1);
    m.popT = 0.06;
    m.overshoot = 0;
    m.squash = 0;
    m.fadeT = 0.22;
  }
}

function flash(s: Spawn): void {
  const m = put(s, 1, PRIM.flash, s.size, 0);
  m.rot = s.hasRot ? s.rot : hashSigned(s.seed, 0) * 0.6;
  m.param = hash01(s.seed, 5);
  m.popT = 0.09;
  m.overshoot = 1.5;
  m.squash = 0;
  m.fadeT = 0.2;
}

/**
 * Streaks that stream past an object: they start behind it (against the direction), lie on both
 * sides, thicker the nearer they are to it, and run on in `s.rot` (up by default) at a speed of
 * several of its sizes a second.
 */
function air(s: Spawn): void {
  const dx = Math.cos(s.rot);
  const dy = Math.sin(s.rot);
  for (let i = 0; i < s.count; i++) {
    const side = hash01(s.seed, i) < 0.5 ? -1 : 1;
    const near = hash01(s.seed, 20 + i);
    const lateral = side * s.size * 0.5 * (0.6 + 1.9 * near);
    const u = s.size * 0.11;
    const len = s.size * hashRange(s.seed, 40 + i, 0.7, 1.4);
    const m = put(s, 0, PRIM.streak, u, i);
    m.aspect = len / u;
    m.param = 0.62 - 0.4 * near;
    m.outline = 1.5;
    const back = s.size * hashRange(s.seed, 60 + i, 0.2, 1.3);
    m.ox = -dy * lateral - dx * back;
    m.oy = dx * lateral - dy * back;
    const v = s.size * hashRange(s.seed, 80 + i, 6, 9);
    m.vx = dx * v;
    m.vy = dy * v;
    m.age = -(s.delay + hash01(s.seed, 90 + i) * s.duration * 0.5);
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1);
    m.popT = 0.12;
    m.overshoot = 0;
    m.squash = 0;
    m.fadeT = 0.2;
  }
}

function cloud(s: Spawn): void {
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 0, PRIM.puff, s.size * hashRange(s.seed, i, 0.85, 1.1), i);
    m.param = 6;
    m.ox = s.count > 1 ? hashSigned(s.seed, 20 + i) * s.size * 0.6 : 0;
    m.vy = s.size * 0.35;
    m.drag = 0.4;
    m.grow = 0.35;
    m.age = -(s.delay + i * 0.1);
    m.popT = 0.18;
    m.overshoot = 1.2;
    m.squash = 0.15;
    m.fadeT = 0.5;
  }
}

function poof(s: Spawn): void {
  const n = Math.max(3, s.count);
  const base = hash01(s.seed, 7) * TAU;
  const centre = put(s, 0, PRIM.puff, s.size * 0.62, 90);
  centre.param = 6;
  centre.grow = 0.3;
  centre.popT = 0.09;
  centre.overshoot = 1.3;
  centre.squash = 0.1;
  centre.fadeT = 0.3;
  for (let i = 0; i < n; i++) {
    const m = put(s, 1, PRIM.puff, s.size * hashRange(s.seed, i, 0.34, 0.5), i);
    const a = base + (i / n) * TAU + hashSigned(s.seed, i) * 0.25;
    m.param = 5;
    m.ox = Math.cos(a) * s.size * 0.1;
    m.oy = Math.sin(a) * s.size * 0.1;
    m.vx = Math.cos(a) * s.size * hashRange(s.seed, 20 + i, 1.5, 2.1);
    m.vy = Math.sin(a) * s.size * hashRange(s.seed, 20 + i, 1.5, 2.1);
    m.drag = 5;
    m.grow = 0.6;
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1);
    m.popT = 0.06;
    m.overshoot = 1.2;
    m.squash = 0.1;
    m.fadeT = 0.3;
  }
}

function beads(s: Spawn): void {
  const base = s.hasRot ? s.rot : Math.PI / 2;
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 1, PRIM.drop, s.size * 0.36 * hashRange(s.seed, i, 0.8, 1.2), i);
    const a = base + hashSigned(s.seed, 20 + i) * 1.15;
    const v = s.size * hashRange(s.seed, 40 + i, 2.4, 4.2);
    m.vx = Math.cos(a) * v;
    m.vy = Math.sin(a) * v;
    m.gy = -s.size * 10;
    m.drag = 0.8;
    m.rot = a - Math.PI / 2;
    m.age = -(s.delay + i * 0.03);
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1.1);
    m.popT = 0.1;
    m.overshoot = 1.6;
    m.squash = 0.15;
    m.fadeT = 0.25;
  }
}

function swear(s: Spawn): void {
  const m = put(s, 2, PRIM.swear, s.size, 0);
  m.rot = tilt(s, 0, 0.12);
  m.popT = 0.18;
  m.overshoot = 2.2;
  m.squash = 0.25;
  m.fadeT = 0.3;
  // Angry shaking: fast and small.
  m.wobble = 0.09;
  m.wobbleHz = 13;
  m.throb = 0.05;
  m.throbHz = 9;
  m.vy = 14;
  m.drag = 1.5;
}

/** Breath from a snout: small puffs that jet out in the direction, swell and thin out. */
function steam(s: Spawn): void {
  const dx = Math.cos(s.rot);
  const dy = Math.sin(s.rot);
  for (let i = 0; i < s.count; i++) {
    const m = put(s, 0, PRIM.puff, s.size * hashRange(s.seed, i, 0.7, 1), i);
    m.param = 5;
    const v = s.size * hashRange(s.seed, 20 + i, 1.6, 2.6);
    m.vx = dx * v + hashSigned(s.seed, 30 + i) * s.size * 0.3;
    m.vy = dy * v + s.size * hashRange(s.seed, 40 + i, 0.2, 0.7);
    m.drag = 2.6;
    m.grow = 1.1;
    m.age = -(s.delay + i * 0.07);
    m.life = s.duration * hashRange(s.seed, 70 + i, 0.8, 1.1);
    m.popT = 0.1;
    m.overshoot = 1.2;
    m.squash = 0.1;
    m.fadeT = 0.5;
  }
}

const RECIPES: Readonly<Record<MarkKind, (s: Spawn) => void>> = {
  bang,
  question,
  sweat,
  vein,
  annoyed,
  spark,
  starburst,
  dizzy,
  sparkle,
  heart,
  note,
  dust,
  zzz,
  speed,
  flash,
  air,
  cloud,
  poof,
  beads,
  swear,
  steam,
};

/** Put the marks of one call on the stage. */
export function spawnKind(s: Spawn): void {
  RECIPES[s.kind](s);
}
