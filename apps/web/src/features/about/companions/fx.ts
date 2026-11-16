/**
 * The comic marks over the companions' stage: an exclamation mark, a question mark, sparkles, a
 * heart, motion lines, a sweat drop, a puff, a dizzy swirl, a laugh, an anger vein and a star.
 * Each is one small element with a drawing inside, laid where it pops and played once by a Web
 * Animation of transform and opacity, then removed. Nothing here runs per frame.
 */
export type MarkKind =
  "bang" | "ask" | "spark" | "heart" | "lines" | "drop" | "puff" | "swirl" | "ha" | "vein" | "star";

export type MarkTone = "ink" | "pink" | "gold" | "cyan";

export interface Fx {
  /** Pop a mark with its middle at (x, y) of the overlay, in CSS pixels. */
  pop: (
    kind: MarkKind,
    x: number,
    y: number,
    options: { tone: MarkTone; size: number; turn?: number },
  ) => void;
  clear: () => void;
  /** Hold the marks where they are (the probes hold the stage's clock), or let them go. */
  hold: (on: boolean) => void;
  /** With the marks held: play them this many seconds on. */
  advance: (seconds: number) => void;
  count: () => number;
}

const SVG = (inner: string) =>
  `<svg viewBox="-20 -20 40 40" width="100%" height="100%" focusable="false" aria-hidden="true">${inner}</svg>`;

/** The drawings, in a box of 40 units with its middle at the origin. */
const DRAWN: Record<MarkKind, string> = {
  bang: SVG(
    '<path d="M-3.4-17h7.4l-2 21h-3.6z" fill="currentColor"/><circle cy="12" r="3.5" fill="currentColor"/>',
  ),
  ask: SVG(
    '<path d="M-8-8.5C-8-14-4-17 0.5-17 5.5-17 9-13.8 9-9.2 9-5.6 6.8-3.8 4.6-2.2 2.9-1 2.2 0 2.2 2.6V4" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="2.2" cy="12" r="3.4" fill="currentColor"/>',
  ),
  spark: SVG(
    '<path d="M0-16C1.6-4 4-1.6 16 0 4 1.6 1.6 4 0 16-1.6 4-4 1.6-16 0-4-1.6-1.6-4 0-16z" fill="currentColor"/>',
  ),
  heart: SVG(
    '<path d="M0 13C-16 2-14-12-6-12-2-12 0-9 0-6 0-9 2-12 6-12 14-12 16 2 0 13z" fill="currentColor"/>',
  ),
  lines: SVG(
    '<path d="M-11-3-16-12M0-7v-11M11-3l5-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  ),
  drop: SVG('<path d="M0-14C6-5 8 1 8 5.5a8 8 0 0 1-16 0C-8 1-6-5 0-14z" fill="currentColor"/>'),
  puff: SVG(
    '<g fill="var(--bg)" stroke="currentColor" stroke-width="2"><circle cx="-7" cy="4" r="7"/><circle cx="4" cy="0" r="9"/><circle cx="13" cy="6" r="5"/></g>',
  ),
  swirl: SVG(
    '<path d="M0 0C3-3 7 0 4 4-1 9-9 4-7-3-5-11 6-13 11-5 15 2 11 11 2 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  ),
  ha: SVG(
    '<path d="M-14-8V8M-14 0h8M-6-8V8M2 8 7-8l5 16M4 3h6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  vein: SVG(
    '<path d="M-4-15C-4-7-7-4-15-4M4-15C4-7 7-4 15-4M-4 15C-4 7-7 4-15 4M4 15C4 7 7 4 15 4" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  ),
  star: SVG(
    '<path d="M0-16 4.7-6.5 15.2-4.9 7.6 2.5 9.4 13 0 8-9.4 13-7.6 2.5-15.2-4.9-4.7-6.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  ),
};

/** The size of a mark as drawn, in CSS pixels, before the cue's own size. */
const BASE: Record<MarkKind, number> = {
  bang: 54,
  ask: 50,
  spark: 38,
  heart: 36,
  lines: 46,
  drop: 28,
  puff: 52,
  swirl: 46,
  ha: 44,
  vein: 40,
  star: 34,
};

/** The page's ink and pink, the gold of Guinevere's drones, the cyan of ours. */
const TONE: Record<MarkTone, string> = {
  ink: "var(--text)",
  pink: "var(--accent)",
  gold: "#e9a51f",
  cyan: "#23d0d8",
};

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

interface Play {
  frames: Keyframe[];
  ms: number;
  easing: string;
}

const at = (x: number, y: number, scale: number, turn = 0) =>
  `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${turn.toFixed(1)}deg) scale(${scale})`;

/** How each mark moves, from its place. `d` is a few pixels that grow with the mark. */
function playOf(kind: MarkKind, x: number, y: number, d: number, side: number, lean: number): Play {
  switch (kind) {
    case "bang":
    case "ask":
      return {
        ms: 900,
        easing: SPRING,
        frames: [
          { transform: at(x, y + d, 0.2, lean - 18 * side), opacity: 0, offset: 0 },
          { transform: at(x, y, 1, lean + 6 * side), opacity: 1, offset: 0.28 },
          { transform: at(x, y, 1, lean + 6 * side), opacity: 1, offset: 0.74, easing: "ease-in" },
          { transform: at(x, y - d * 0.4, 0.9, lean + 6 * side), opacity: 0, offset: 1 },
        ],
      };
    case "spark":
      return {
        ms: 640,
        easing: OUT,
        frames: [
          { transform: at(x, y, 0, lean), opacity: 1 },
          {
            transform: at(x + side * d * 0.2, y - d * 0.3, 1, lean + 60),
            opacity: 1,
            offset: 0.45,
          },
          { transform: at(x + side * d * 0.3, y - d * 0.5, 0, lean + 120), opacity: 1 },
        ],
      };
    case "star":
      return {
        ms: 900,
        easing: OUT,
        frames: [
          { transform: at(x, y, 0, lean), opacity: 1 },
          {
            transform: at(x + side * d * 0.9, y - d * 1.1, 1, lean + 120 * side),
            opacity: 1,
            offset: 0.4,
          },
          {
            transform: at(x + side * d * 1.5, y - d * 0.6, 0.9, lean + 220 * side),
            opacity: 1,
            offset: 0.75,
          },
          { transform: at(x + side * d * 1.8, y + d * 0.2, 0.4, lean + 300 * side), opacity: 0 },
        ],
      };
    case "heart":
      return {
        ms: 1400,
        easing: OUT,
        frames: [
          { transform: at(x, y + d * 0.4, 0, lean - 10 * side), opacity: 0 },
          { transform: at(x, y, 1.1, lean + 6 * side), opacity: 1, offset: 0.22 },
          {
            transform: at(x + side * d * 0.3, y - d * 1.2, 1, lean - 6 * side),
            opacity: 1,
            offset: 0.7,
          },
          { transform: at(x + side * d * 0.1, y - d * 1.9, 0.9, lean + 4 * side), opacity: 0 },
        ],
      };
    case "lines":
      return {
        ms: 420,
        easing: OUT,
        frames: [
          { transform: at(x, y, 0.4, lean), opacity: 1 },
          { transform: at(x, y, 1.1, lean), opacity: 1, offset: 0.6 },
          { transform: at(x, y, 1.25, lean), opacity: 0 },
        ],
      };
    case "drop":
      return {
        ms: 900,
        easing: "ease-in",
        frames: [
          { transform: at(x, y, 0.3, lean), opacity: 0 },
          { transform: at(x, y, 1, lean), opacity: 1, offset: 0.2 },
          { transform: at(x, y + d * 0.9, 1, lean), opacity: 1, offset: 0.8 },
          { transform: at(x, y + d * 1.2, 0.8, lean), opacity: 0 },
        ],
      };
    case "puff":
      return {
        ms: 560,
        easing: OUT,
        frames: [
          { transform: at(x, y, 0.3, lean), opacity: 0.9 },
          { transform: at(x + side * d * 0.5, y - d * 0.3, 1, lean), opacity: 0.9, offset: 0.5 },
          { transform: at(x + side * d * 0.8, y - d * 0.5, 1.15, lean), opacity: 0 },
        ],
      };
    case "swirl":
      return {
        ms: 1100,
        easing: "linear",
        frames: [
          { transform: at(x, y, 0.2, 0), opacity: 0 },
          { transform: at(x, y, 1, 150), opacity: 1, offset: 0.15 },
          { transform: at(x, y - d * 0.2, 1, 620), opacity: 1, offset: 0.8 },
          { transform: at(x, y - d * 0.3, 0.7, 780), opacity: 0 },
        ],
      };
    case "ha":
      return {
        ms: 700,
        easing: SPRING,
        frames: [
          { transform: at(x, y + d * 0.3, 0.3, lean - 8 * side), opacity: 0 },
          { transform: at(x, y, 1, lean + 6 * side), opacity: 1, offset: 0.3 },
          { transform: at(x, y - d * 0.2, 1, lean - 4 * side), opacity: 1, offset: 0.7 },
          { transform: at(x, y - d * 0.5, 0.9, lean + 4 * side), opacity: 0 },
        ],
      };
    case "vein":
      return {
        ms: 1100,
        easing: SPRING,
        frames: [
          { transform: at(x, y, 0.2, lean), opacity: 0 },
          { transform: at(x, y, 1.15, lean + 8), opacity: 1, offset: 0.18 },
          { transform: at(x, y, 0.9, lean - 4), opacity: 1, offset: 0.36 },
          { transform: at(x, y, 1.1, lean + 6), opacity: 1, offset: 0.54 },
          { transform: at(x, y, 0.95, lean), opacity: 1, offset: 0.8 },
          { transform: at(x, y, 0.6, lean), opacity: 0 },
        ],
      };
  }
}

/** No more marks than this at once: a storm of presses must not fill the page with elements. */
const MOST = 18;

export function createFx(host: HTMLElement, className: string): Fx {
  const live = new Map<HTMLElement, Animation>();
  let count = 0;
  let held = false;

  const drop = (el: HTMLElement) => {
    live.delete(el);
    el.remove();
  };

  return {
    pop: (kind, x, y, { tone, size, turn = 0 }) => {
      if (live.size >= MOST || typeof host.animate !== "function") return;
      const el = document.createElement("span");
      el.className = className;
      el.innerHTML = DRAWN[kind];
      const px = BASE[kind] * size;
      el.style.cssText = `width:${px.toFixed(1)}px;height:${px.toFixed(1)}px;margin:${(-px / 2).toFixed(1)}px 0 0 ${(-px / 2).toFixed(1)}px;color:${TONE[tone]}`;
      host.append(el);
      count += 1;
      // The marks lean a little, to one side then the other.
      const side = count % 2 === 0 ? 1 : -1;
      const play = playOf(kind, x, y, px * 0.5, side, turn);
      const animation = el.animate(play.frames, {
        duration: play.ms,
        easing: play.easing,
        fill: "both",
      });
      live.set(el, animation);
      if (held) animation.pause();
      animation.onfinish = () => drop(el);
      animation.oncancel = () => drop(el);
    },
    clear: () => {
      for (const el of [...live.keys()]) drop(el);
    },
    hold: (on) => {
      held = on;
      for (const animation of live.values()) {
        if (on) animation.pause();
        else animation.play();
      }
    },
    advance: (seconds) => {
      for (const [el, animation] of [...live]) {
        const next = Number(animation.currentTime ?? 0) + seconds * 1000;
        const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
        if (next >= end) drop(el);
        else animation.currentTime = next;
      }
    },
    count: () => live.size,
  };
}
