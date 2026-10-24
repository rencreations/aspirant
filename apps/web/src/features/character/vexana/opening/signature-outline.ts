/**
 * Turns a centre line (`M` and cubic `C` segments) into the outline of a stroke whose width
 * follows a pressure profile, and samples points along it. Pure maths, no DOM, so the shapes are
 * the same on the server and in the browser, and can be tested.
 */
type Pt = readonly [number, number];

/** The cubic segments of a path made of one `M` and `C` commands. */
function segments(d: string): Pt[][] {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const out: Pt[][] = [];
  let cur: Pt = [nums[0] ?? 0, nums[1] ?? 0];
  for (let i = 2; i + 5 < nums.length + 0; i += 6) {
    const p1: Pt = [nums[i] ?? 0, nums[i + 1] ?? 0];
    const p2: Pt = [nums[i + 2] ?? 0, nums[i + 3] ?? 0];
    const p3: Pt = [nums[i + 4] ?? 0, nums[i + 5] ?? 0];
    out.push([cur, p1, p2, p3]);
    cur = p3;
  }
  return out;
}

function cubic(s: Pt[], t: number): Pt {
  const [a, b, c, e] = s as [Pt, Pt, Pt, Pt];
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return [
    w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * e[0],
    w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * e[1],
  ];
}

/** Evenly spaced points along the whole path, `count` of them, from first to last. */
export function samplePath(d: string, count: number): Pt[] {
  const segs = segments(d);
  const fine: Pt[] = [];
  for (const s of segs) {
    for (let i = 0; i < 40; i++) fine.push(cubic(s, i / 40));
  }
  const last = segs[segs.length - 1];
  if (last) fine.push(last[3]!);
  // Arc length, then resample at equal steps.
  const len: number[] = [0];
  for (let i = 1; i < fine.length; i++) {
    const a = fine[i - 1]!;
    const b = fine[i]!;
    len.push((len[i - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = len[len.length - 1] ?? 1;
  const pts: Pt[] = [];
  let j = 1;
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total;
    while (j < fine.length - 1 && (len[j] ?? 0) < target) j++;
    const a = fine[j - 1]!;
    const b = fine[j]!;
    const span = (len[j] ?? 0) - (len[j - 1] ?? 0) || 1;
    const f = (target - (len[j - 1] ?? 0)) / span;
    pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return pts;
}

/** The pressure at `t` (0 to 1) along a profile, smoothly. */
export function pressureAt(press: readonly number[], t: number): number {
  if (press.length === 1) return press[0] ?? 1;
  const x = Math.min(1, Math.max(0, t)) * (press.length - 1);
  const i = Math.min(press.length - 2, Math.floor(x));
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  return (press[i] ?? 0) * (1 - s) + (press[i + 1] ?? 0) * s;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/**
 * The outline of the stroke as a closed path. `scale` widens it (the glow layers use more than
 * one). The ends are round.
 */
export function strokeOutline(
  d: string,
  width: number,
  press: readonly number[],
  scale = 1,
  count = 72,
): string {
  const pts = samplePath(d, count);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const half: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const n = Math.hypot(tx, ty) || 1;
    const nx = -ty / n;
    const ny = tx / n;
    const h = (width * scale * Math.max(0.06, pressureAt(press, i / (pts.length - 1)))) / 2;
    half.push(h);
    const p = pts[i]!;
    left.push([p[0] + nx * h, p[1] + ny * h]);
    right.push([p[0] - nx * h, p[1] - ny * h]);
  }
  // A round cap turns from the side the stroke came along to the other side, through its tip.
  const cap = (end: 0 | 1): Pt[] => {
    const i = end === 0 ? 0 : pts.length - 1;
    const p = pts[i]!;
    const a = (end === 0 ? right[0] : left[left.length - 1])!;
    const h = half[i] ?? 1;
    const base = Math.atan2(a[1] - p[1], a[0] - p[0]);
    const out: Pt[] = [];
    for (let k = 1; k < 6; k++) {
      const ang = base - (Math.PI * k) / 6;
      out.push([p[0] + Math.cos(ang) * h, p[1] + Math.sin(ang) * h]);
    }
    return out;
  };
  const ring: Pt[] = [...left, ...cap(1), ...[...right].reverse(), ...cap(0)];
  return `M${ring.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join("L")}Z`;
}
