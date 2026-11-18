export interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

/**
 * A fixed scatter of stars in a 100 by 100 box: the same list every time (a small deterministic
 * generator, never `Math.random`, so the server markup and the client agree).
 */
export function starField(count: number): Star[] {
  let seed = 7919;
  const next = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = next() * 100;
    const y = next() * 100;
    const r = 0.1 + next() * 0.24;
    const o = 0.25 + next() * 0.6;
    out.push({
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      r: Math.round(r * 100) / 100,
      o: Math.round(o * 100) / 100,
    });
  }
  return out;
}
