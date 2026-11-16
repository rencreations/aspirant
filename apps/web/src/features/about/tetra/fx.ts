import type { MarkKind } from "./performance";

/**
 * The comic marks over Tetra's stage: an exclamation mark, sparkles, a heart, music notes, motion
 * lines, a sweat drop, dust and a dizzy swirl. Each is one small element with a drawing inside,
 * laid where it pops and played once by a Web Animation of transform and opacity, then removed.
 * Nothing here runs per frame.
 */
export interface Fx {
  /** Pop a mark with its middle at (x, y) of the overlay, in CSS pixels. */
  pop: (
    kind: MarkKind,
    x: number,
    y: number,
    options: { tone: "ink" | "pink" | "cyan"; size: number },
  ) => void;
  clear: () => void;
  /** Hold the marks where they are (the probes hold the stage's clock), or let them go. */
  hold: (on: boolean) => void;
  /** With the marks held: play them this many seconds on. */
  advance: (seconds: number) => void;
}

const SVG = (inner: string) =>
  `<svg viewBox="-20 -20 40 40" width="100%" height="100%" focusable="false" aria-hidden="true">${inner}</svg>`;

/** The drawings, in a box of 40 units with its middle at the origin. */
const DRAWN: Record<MarkKind, string> = {
  bang: SVG(
    '<path d="M-3.4-17h7.4l-2 21h-3.6z" fill="currentColor"/><circle cy="12" r="3.5" fill="currentColor"/>',
  ),
  spark: SVG(
    '<path d="M0-16C1.6-4 4-1.6 16 0 4 1.6 1.6 4 0 16-1.6 4-4 1.6-16 0-4-1.6-1.6-4 0-16z" fill="currentColor"/>',
  ),
  heart: SVG(
    '<path d="M0 13C-16 2-14-12-6-12-2-12 0-9 0-6 0-9 2-12 6-12 14-12 16 2 0 13z" fill="currentColor"/>',
  ),
  note: SVG(
    '<ellipse cx="-4" cy="10" rx="5.6" ry="4.1" transform="rotate(-20 -4 10)" fill="currentColor"/><path d="M0.4 9.5V-15l12 4v6.4l-9-3V9.5z" fill="currentColor"/>',
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
};

/** The size of a mark as drawn, in CSS pixels, before the cue's own size. */
const BASE: Record<MarkKind, number> = {
  bang: 58,
  spark: 40,
  heart: 38,
  note: 42,
  lines: 50,
  drop: 30,
  puff: 56,
  swirl: 48,
  ha: 46,
};

const TONE = { ink: "var(--text)", pink: "var(--accent)", cyan: "#23d0d8" } as const;

const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

interface Play {
  frames: Keyframe[];
  ms: number;
  easing: string;
}

const at = (x: number, y: number, scale: number, turn = 0) =>
  `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${turn}deg) scale(${scale})`;

/** How each mark moves, from its place. `d` is a few pixels that grow with the mark. */
function playOf(kind: MarkKind, x: number, y: number, d: number, side: number): Play {
  switch (kind) {
    case "bang":
      return {
        ms: 820,
        easing: SPRING,
        frames: [
          { transform: at(x, y + d, 0.2, -18 * side), opacity: 0, offset: 0 },
          { transform: at(x, y, 1, 6 * side), opacity: 1, offset: 0.3 },
          { transform: at(x, y, 1, 6 * side), opacity: 1, offset: 0.72, easing: "ease-in" },
          { transform: at(x, y - d * 0.4, 0.9, 6 * side), opacity: 0, offset: 1 },
        ],
      };
    case "spark":
      return {
        ms: 640,
        easing: OUT,
        frames: [
          { transform: at(x, y, 0, 0), opacity: 1 },
          { transform: at(x + side * d * 0.2, y - d * 0.3, 1, 60), opacity: 1, offset: 0.45 },
          { transform: at(x + side * d * 0.3, y - d * 0.5, 0, 120), opacity: 1 },
        ],
      };
    case "heart":
      return {
        ms: 1400,
        easing: OUT,
        frames: [
          { transform: at(x, y + d * 0.4, 0, -10 * side), opacity: 0 },
          { transform: at(x, y, 1.1, 6 * side), opacity: 1, offset: 0.22 },
          { transform: at(x + side * d * 0.3, y - d * 1.2, 1, -6 * side), opacity: 1, offset: 0.7 },
          { transform: at(x + side * d * 0.1, y - d * 1.9, 0.9, 4 * side), opacity: 0 },
        ],
      };
    case "note":
      return {
        ms: 1150,
        easing: OUT,
        frames: [
          { transform: at(x, y + d * 0.3, 0.2, -14 * side), opacity: 0 },
          { transform: at(x + side * d * 0.2, y, 1, 10 * side), opacity: 1, offset: 0.25 },
          { transform: at(x + side * d * 0.6, y - d * 0.9, 1, -8 * side), opacity: 1, offset: 0.7 },
          { transform: at(x + side * d * 0.8, y - d * 1.4, 0.9, 10 * side), opacity: 0 },
        ],
      };
    case "lines":
      return {
        ms: 420,
        easing: OUT,
        frames: [
          { transform: at(x, y + d * 0.3, 0.4, 0), opacity: 1 },
          { transform: at(x, y, 1.1, 0), opacity: 1, offset: 0.6 },
          { transform: at(x, y - d * 0.2, 1.2, 0), opacity: 0 },
        ],
      };
    case "drop":
      return {
        ms: 900,
        easing: "ease-in",
        frames: [
          { transform: at(x, y, 0.3, 0), opacity: 0 },
          { transform: at(x, y, 1, 0), opacity: 1, offset: 0.2 },
          { transform: at(x, y + d * 0.9, 1, 0), opacity: 1, offset: 0.8 },
          { transform: at(x, y + d * 1.2, 0.8, 0), opacity: 0 },
        ],
      };
    case "puff":
      return {
        ms: 560,
        easing: OUT,
        frames: [
          { transform: at(x, y, 0.3, 0), opacity: 0.9 },
          { transform: at(x + side * d * 0.5, y - d * 0.3, 1, 0), opacity: 0.9, offset: 0.5 },
          { transform: at(x + side * d * 0.8, y - d * 0.5, 1.15, 0), opacity: 0 },
        ],
      };
    case "swirl":
      return {
        ms: 1050,
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
        ms: 680,
        easing: SPRING,
        frames: [
          { transform: at(x, y + d * 0.3, 0.3, -8 * side), opacity: 0 },
          { transform: at(x, y, 1, 6 * side), opacity: 1, offset: 0.3 },
          { transform: at(x, y - d * 0.2, 1, -4 * side), opacity: 1, offset: 0.7 },
          { transform: at(x, y - d * 0.5, 0.9, 4 * side), opacity: 0 },
        ],
      };
  }
}

/** No more marks than this at once: a storm of presses must not fill the page with elements. */
const MOST = 16;

export function createFx(host: HTMLElement, className: string): Fx {
  const live = new Map<HTMLElement, Animation>();
  let count = 0;
  let held = false;

  const drop = (el: HTMLElement) => {
    live.delete(el);
    el.remove();
  };

  return {
    pop: (kind, x, y, { tone, size }) => {
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
      const play = playOf(kind, x, y, px * 0.5, side);
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
        const at = Number(animation.currentTime ?? 0) + seconds * 1000;
        const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
        if (at >= end) drop(el);
        else animation.currentTime = at;
      }
    },
  };
}
