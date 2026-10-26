/**
 * The shape of the heart that closes over a section. The hole is a heart; the colour is everything
 * outside it. Everything here is plain arithmetic (no DOM), so it can be tested.
 */

type P = readonly [number, number];
type Seg = readonly [P, P, P, P];

/** The heart, as four cubic curves in a 100-unit box, the same shape as the heart of the old scene. */
const SEGS: readonly Seg[] = [
  [
    [50, 86],
    [8, 56],
    [-2, 30],
    [14, 14],
  ],
  [
    [14, 14],
    [28, 1],
    [45, 9],
    [50, 24],
  ],
  [
    [50, 24],
    [55, 9],
    [72, 1],
    [86, 14],
  ],
  [
    [86, 14],
    [102, 30],
    [92, 56],
    [50, 86],
  ],
];

/** The visual middle of the heart in its box: the hole is centred on this point. */
const CX = 50;
const CY = 46;

const cubic = (s: Seg, t: number): P => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0] - CX,
    a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1] - CY,
  ];
};

/** The outline of the heart, relative to its middle, in box units. */
const OUTLINE: readonly P[] = SEGS.flatMap((s) =>
  Array.from({ length: 28 }, (_, i) => cubic(s, i / 28)),
);

/** Whether a point (relative to the middle, in box units) is inside the heart. */
export function inHeart(x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i]!;
    const [xj, yj] = OUTLINE[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Points along the border of a w by h rectangle centred on the origin. */
function border(w: number, h: number, per = 14): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= per; i++) {
    const f = i / per;
    pts.push([-w / 2 + f * w, -h / 2], [-w / 2 + f * w, h / 2]);
    pts.push([-w / 2, -h / 2 + f * h], [w / 2, -h / 2 + f * h]);
  }
  return pts;
}

/**
 * The smallest scale (pixels per box unit) at which the heart, centred on the screen, holds the whole
 * w by h screen: the hole at its widest, with nothing of the colour showing.
 */
export function openScale(w: number, h: number): number {
  const pts = border(w, h);
  const holds = (k: number) => pts.every(([x, y]) => inHeart(x / k, y / k));
  let lo = 0.01;
  let hi = Math.max(w, h);
  while (!holds(hi)) hi *= 2;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (holds(mid)) hi = mid;
    else lo = mid;
  }
  return hi * 1.04;
}

/**
 * The scale below which a point of the screen (relative to its middle) is outside the heart, that
 * is covered by the colour. Used to know when the corner with the nav text is covered.
 */
export function coverScale(x: number, y: number): number {
  let lo = 0.01;
  let hi = Math.max(Math.abs(x), Math.abs(y)) * 4 + 100;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (inHeart(x / mid, y / mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Progress 0 (hole wide open) to 1 (shut) to the scale of the hole. */
export function scaleAt(p: number, open: number): number {
  const s = 1 - easeInOut(Math.min(1, Math.max(0, p)));
  return open * Math.pow(s, 1.8);
}

/** The progress at which the hole has shrunk to `k` (the inverse of `scaleAt`). */
export function progressAt(k: number, open: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (scaleAt(mid, open) > k) lo = mid;
    else hi = mid;
  }
  return hi;
}

const f = (n: number) => n.toFixed(1);

/**
 * The `clip-path` of the colour: the whole w by h rectangle with a heart cut out of its middle
 * (even-odd), the heart `k` pixels per box unit.
 */
export function heartClip(w: number, h: number, k: number): string {
  const x = (u: number) => f(w / 2 + (u - CX) * k);
  const y = (v: number) => f(h / 2 + (v - CY) * k);
  const first = SEGS[0]![0];
  let d = `M0 0H${f(w)}V${f(h)}H0Z M${x(first[0])} ${y(first[1])}`;
  for (const s of SEGS) {
    d += ` C${x(s[1][0])} ${y(s[1][1])} ${x(s[2][0])} ${y(s[2][1])} ${x(s[3][0])} ${y(s[3][1])}`;
  }
  return `path(evenodd, "${d} Z")`;
}
