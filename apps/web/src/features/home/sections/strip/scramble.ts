/**
 * The word swap of the reference's buttons: the new word resolves from left to right and the letters
 * that have not come in are random capitals (digest `ref-psychoactive-tib.md` 1.5, "scrambleText",
 * `ease: none`). Pure: a function of the target, the progress and a tick that changes the noise a
 * few times a second, so a frozen frame is the same every time.
 */

const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A fixed random letter for a place and a tick. */
function noiseAt(i: number, tick: number): string {
  let h = Math.imul(i + 1, 2654435761) ^ Math.imul(tick + 1, 40503);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return NOISE[h % NOISE.length]!;
}

/** `to` when `progress` is 1; at 0 every letter is noise. Spaces and marks that are not letters stay. */
export function scrambleAt(to: string, progress: number, tick: number): string {
  if (progress >= 1) return to;
  const n = to.length;
  const resolved = Math.floor(Math.max(0, progress) * n);
  let out = "";
  for (let i = 0; i < n; i++) {
    const c = to[i]!;
    out += i < resolved || !/[A-Za-z0-9]/.test(c) ? c : noiseAt(i, tick);
  }
  return out;
}
