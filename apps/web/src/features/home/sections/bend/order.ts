/**
 * Small pure helpers of the bend section: the order of the fan pictures (the owner asked for them
 * picked at random), and where the credit plate of a picture stands. No three.js, no DOM.
 */

/** A seeded generator (mulberry32): the same seed gives the same line, so a probe can fix it. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The numbers 0 to n - 1 in a random order that depends on `seed` only. */
export function shuffled(n: number, seed: number): number[] {
  const next = rng(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const t = order[i]!;
    order[i] = order[j]!;
    order[j] = t;
  }
  return order;
}

/**
 * The picture of each card of the wall: the first `unique` cards each get a picture of their own
 * (in the shuffled order), the rest repeat pictures that are far from where they were first used, so
 * two copies of one picture are never side by side.
 */
export function wallPictures(cards: number, unique: number, seed: number): number[] {
  const order = shuffled(unique, seed);
  return Array.from({ length: cards }, (_, i) =>
    i < unique ? order[i]! : order[(i * 7 + 3) % unique]!,
  );
}

/** A point and a size on the screen, CSS pixels from the top left. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where a plate of `size` stands for a card at `card`: beside it, on the side with more room, level
 * with its middle, and always inside the screen with a margin (`top` more of it above, for the bar).
 * Writes the top left into `out`.
 */
export function platePlace(
  card: Box,
  size: { w: number; h: number },
  screen: { w: number; h: number },
  out: { x: number; y: number },
  margin = 12,
  top = 0,
): { x: number; y: number } {
  const room = { right: screen.w - (card.x + card.w), left: card.x };
  const gap = 14;
  let x =
    room.right >= size.w + gap + margin || room.right >= room.left
      ? card.x + card.w + gap
      : card.x - size.w - gap;
  let y = card.y + card.h / 2 - size.h / 2;
  x = Math.min(screen.w - size.w - margin, Math.max(margin, x));
  y = Math.min(screen.h - size.h - margin, Math.max(margin + top, y));
  out.x = x;
  out.y = y;
  return out;
}
