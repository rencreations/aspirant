/**
 * Whether a playing video is hidden behind another section. The page lays sections over each other
 * (the craft sheet over the film, the rising interlude over the pair, the music over the fanart): a
 * video under one is still "on screen" for an observer, so it kept decoding where nobody could see
 * it, and two decoders at once cost a laptop about 20 frames a second.
 *
 * The test is the one a visitor's eye makes: look at a few points inside the visible part of the
 * video and ask what is on top there. When every point has another SECTION on top, it is covered. An
 * element that belongs to no section (the bar, a transition scene) never counts, so something that is
 * only passing over the picture does not stop it, and neither does an element of its own section.
 */
export function coveredBySection(video: Element, hits: ReadonlyArray<Element | null>): boolean {
  if (hits.length === 0) return false;
  const own = video.closest("section");
  return hits.every((hit) => {
    if (!hit || hit === video || video.contains(hit)) return false;
    const other = hit.closest("section");
    return other !== null && other !== own;
  });
}

/** Points to look at inside the part of a rectangle that is on the screen (fractions of it). */
const SPOTS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.5],
  [0.25, 0.3],
  [0.75, 0.3],
  [0.25, 0.7],
  [0.75, 0.7],
];

export function samplePoints(
  r: { left: number; top: number; right: number; bottom: number },
  vw: number,
  vh: number,
): Array<[number, number]> {
  const left = Math.max(1, r.left);
  const top = Math.max(1, r.top);
  const right = Math.min(vw - 1, r.right);
  const bottom = Math.min(vh - 1, r.bottom);
  if (right - left < 4 || bottom - top < 4) return [];
  return SPOTS.map(([fx, fy]) => [left + (right - left) * fx, top + (bottom - top) * fy]);
}

/**
 * Whether a focused control is where a keyboard user can see it: inside the screen, below the bar
 * at the top, and with some of it showing. A control with no size is not drawn at all (a hidden
 * input), so there is nothing to bring into view.
 */
export function focusVisible(
  r: { left: number; top: number; right: number; bottom: number },
  vw: number,
  vh: number,
  bar = 72,
): "ok" | "off" | "undrawn" {
  if (r.right - r.left <= 0 || r.bottom - r.top <= 0) return "undrawn";
  const shown = r.bottom > bar + 8 && r.top < vh - 8 && r.right > 8 && r.left < vw - 8;
  return shown ? "ok" : "off";
}
