/**
 * Waits until the page has stopped stuttering, then calls `done`. The page jumps to the next
 * section while a scene covers the screen, and painting that section's first screen takes the
 * graphics process a few hundred milliseconds: frames come out long until it is done. The scene
 * waits for it (real frame times, never a timer that pretends): the stall happens behind a cover
 * that is standing still, and the reveal that follows is smooth. It gives up after `maxMs`, and
 * also when the tab is hidden (no frames are drawn there), so a transition can never hang.
 */
export function whenCalm(
  done: () => void,
  { minFrames = 2, calmFrames = 3, calmMs = 26, maxMs = 650 } = {},
): () => void {
  let raf = 0;
  let timer = 0;
  let last = 0;
  let calm = 0;
  let frames = 0;
  let over = false;
  const start = performance.now();

  const end = () => {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    done();
  };

  const step = (now: number) => {
    if (over) return;
    const dt = last ? now - last : Infinity;
    last = now;
    frames += 1;
    if (frames > minFrames) calm = dt <= calmMs ? calm + 1 : 0;
    if ((frames > minFrames && calm >= calmFrames) || now - start >= maxMs) {
      end();
      return;
    }
    raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);
  timer = window.setTimeout(end, maxMs + 250);
  return () => {
    over = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
  };
}
