/**
 * Two actors play baked clips by the scroll and by their own clocks (Selena, Silverbolt): what a frame
 * shows is a clip at a time with maybe a second one blended in. `mixJumped` tells a frame whose pose
 * jumped from the one before (another clip came in whole, a clip moved far in time) from a blend that
 * moves a little each frame, so an actor can cross fade the first and leave the second alone. Pure.
 */

/** A time moved by more than `limit` seconds (a loop of length `duration` wraps the shorter way). */
function timeJumped(
  prev: number,
  next: number,
  duration: number,
  loops: boolean,
  limit: number,
): boolean {
  let d = Math.abs(next - prev);
  if (loops && duration > 0) d = Math.min(d, duration - d);
  return d > limit;
}

/** The baked clips a frame shows: `a` at `ta`, and `b` at `tb` blended in by `w` (no `b`: `w` is 0). */
export interface ClipMix {
  a: string;
  ta: number;
  b: string | null;
  tb: number;
  w: number;
}

export function newClipMix(): ClipMix {
  return { a: "", ta: 0, b: null, tb: 0, w: 0 };
}

export function copyClipMix(from: ClipMix, to: ClipMix): ClipMix {
  to.a = from.a;
  to.ta = from.ta;
  to.b = from.b;
  to.tb = from.tb;
  to.w = from.w;
  return to;
}

function shareOf(m: ClipMix, name: string): number {
  const w = m.b === null ? 0 : Math.min(1, Math.max(0, m.w));
  return (m.a === name ? 1 - w : 0) + (m.b === name ? w : 0);
}

function timeOf(m: ClipMix, name: string): number {
  if (m.b === name && (m.a !== name || m.w >= 0.5)) return m.tb;
  return m.ta;
}

/**
 * True when the pose shown jumps between two frames' mixes: the share of a clip moved by more than
 * `share` in one frame (another clip came in whole), or a clip both frames show at more than 0.1 moved
 * in time by more than `limit` seconds (a loop wraps the shorter way). A blend whose weight moves a
 * little each frame is not a jump. The times are wrapped here, so a clock past the clip's length is fine.
 */
export function mixJumped(
  prev: ClipMix,
  next: ClipMix,
  durations: Readonly<Record<string, number>>,
  loops: Readonly<Record<string, boolean>>,
  limit = 0.3,
  share = 0.5,
): boolean {
  const names = [prev.a, prev.b, next.a, next.b];
  let moved = 0;
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (!name || names.indexOf(name) !== i) continue;
    const p = shareOf(prev, name);
    const n = shareOf(next, name);
    moved += Math.abs(n - p);
    if (p > 0.1 && n > 0.1) {
      const dur = durations[name] ?? 0;
      const loop = loops[name] ?? false;
      const wrap = (t: number): number =>
        dur > 0 ? (loop ? ((t % dur) + dur) % dur : Math.min(dur, Math.max(0, t))) : 0;
      if (timeJumped(wrap(timeOf(prev, name)), wrap(timeOf(next, name)), dur, loop, limit)) {
        return true;
      }
    }
  }
  return moved > share;
}
