/**
 * The lines behind the ring. The reference draws the contour lines of its mascot around the
 * carousel; ours are the contours of the stage itself: the outline of the panel in front, offset
 * outwards again and again, rounder and a little more uneven the further out they go, like the
 * lines of a map around a raised plate. Pure: the page draws them once per screen size.
 */

interface Ring {
  /** Centre of the panel in front, in screen pixels. */
  cx: number;
  cy: number;
  /** Half the size of the panel. */
  hw: number;
  hh: number;
}

const POINTS = 144;

/** A superellipse point: `n` near 2 is an ellipse, a larger `n` a rounded rectangle. */
function superellipse(t: number, a: number, b: number, n: number): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const e = 2 / n;
  return [a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(s) * Math.abs(s) ** e];
}

/**
 * The contour paths for a screen, from the innermost out. `gap` is the distance between two lines.
 * Each line is closed, and each is a little rounder and more uneven than the one inside it.
 */
export function contourPaths(ring: Ring, view: { w: number; h: number }, gap: number): string[] {
  const out: string[] = [];
  const reach = Math.hypot(view.w, view.h);
  // Start a little inside the panel, so the first lines hide behind it and the rest fan out.
  for (let k = 0; ; k += 1) {
    const grow = k * gap;
    const a = ring.hw * 0.82 + grow;
    const b = ring.hh * 0.82 + grow;
    if (Math.min(a, b) > reach) break;
    const n = Math.max(2.15, 5.2 - k * 0.32);
    const wobble = Math.min(0.045, 0.004 + k * 0.0026);
    const phase = k * 0.9;
    let d = "";
    for (let i = 0; i < POINTS; i += 1) {
      const t = (i / POINTS) * Math.PI * 2;
      const [x, y] = superellipse(t, a, b, n);
      const r = 1 + wobble * Math.sin(3 * t + phase) + wobble * 0.6 * Math.sin(5 * t - phase * 1.7);
      const px = ring.cx + x * r;
      const py = ring.cy + y * r;
      d += `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    out.push(`${d}Z`);
    if (out.length > 40) break;
  }
  return out;
}
