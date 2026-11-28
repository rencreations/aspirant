/**
 * The arithmetic of TheMLabel's content. Every part below the definition is drawn by the scroll:
 * a part's state is a pure function of how far it has travelled up the screen, so a scroll back up
 * plays it back, and a hard flick can never leave it half drawn or make it vanish. Nothing here
 * touches the page.
 *
 * A part is measured in screens. Its pass starts when its top meets the foot of the screen (0) and
 * ends when its foot leaves the top (1 + its height in screens). A part that is held on the screen
 * (sticky, `pin`) is still measured by its tall box: its pass then runs 0 to 1 while it comes up,
 * stays on the screen from 1 to its length, and leaves from there.
 *
 * Each moving element is given poses at points of that pass (`Key`). They become the keyframes of
 * one paused Web Animation whose clock is the pass (`PASS_MS` for the whole of it), so only
 * transform and opacity move and the browser does the in-betweens.
 */

/** The clock of one pass, in milliseconds. Offsets of the keyframes are shares of it. */
export const PASS_MS = 10_000;

/** How fast the drawn point follows the scroll's, per second (a time constant of about 80 ms). */
const FOLLOW_RATE = 12;

/** The house easings, as the keyframes take them. */
export const EASE = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  in: "cubic-bezier(0.7, 0, 0.84, 0)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  house: "cubic-bezier(0.32, 0.72, 0, 1)",
  tick: "cubic-bezier(0.7, 0, 0.2, 1)",
  linear: "linear",
} as const;

/**
 * A state of one element. `x` and `y` are percent of the element's own box (a line that rises
 * out of its mask moves by its own height), `vw` and `vh` are percent of the screen (the frame of
 * the hall comes in from the corners), `px` is pixels (a step aside by a fixed room). `ry` turns
 * about the vertical axis, `r` about the screen's.
 */
export interface Pose {
  readonly x?: number;
  readonly y?: number;
  readonly vw?: number;
  readonly vh?: number;
  readonly px?: number;
  readonly ry?: number;
  readonly r?: number;
  readonly s?: number;
  readonly sx?: number;
  readonly sy?: number;
  readonly o?: number;
}

/** A pose at a point of the pass, in screens, and the easing toward the next one. */
export type Key = readonly [at: number, pose: Pose, easing?: string];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const num = (v: number, digits = 3) => Number(v.toFixed(digits));

/**
 * The transform of a pose. Every pose of an element writes the same list of functions, so they
 * interpolate; `depth` adds the perspective and the turn about the vertical axis, only for the
 * elements that turn.
 */
export function transformOf(p: Pose, depth = false): string {
  const sx = p.sx ?? p.s ?? 1;
  const sy = p.sy ?? p.s ?? 1;
  const move =
    `translate(calc(${num(p.vw ?? 0)}vw + ${num(p.px ?? 0)}px), ${num(p.vh ?? 0)}vh) ` +
    `translate(${num(p.x ?? 0)}%, ${num(p.y ?? 0)}%)`;
  const turn = depth ? ` rotateY(${num(p.ry ?? 0)}deg)` : "";
  const rest = ` rotate(${num(p.r ?? 0)}deg) scale(${num(sx, 4)}, ${num(sy, 4)})`;
  return `${depth ? "perspective(1200px) " : ""}${move}${turn}${rest}`;
}

/**
 * The keyframes of a list of keys over a pass of `span` screens. The keys are put in order and
 * held at both ends, so before its first key and after its last an element keeps those poses.
 */
export function keyframes(keys: readonly Key[], span: number): Keyframe[] {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last || span <= 0) return [];
  const depth = sorted.some(([, pose]) => pose.ry !== undefined);
  const frame = (offset: number, pose: Pose, easing: string = EASE.linear): Keyframe => ({
    offset: num(clamp01(offset), 5),
    transform: transformOf(pose, depth),
    opacity: num(pose.o ?? 1),
    easing,
  });
  const out: Keyframe[] = [];
  if (first[0] / span > 0) out.push(frame(0, first[1]));
  for (const [at, pose, easing] of sorted) out.push(frame(at / span, pose, easing));
  if (last[0] / span < 1) out.push(frame(1, last[1]));
  return out;
}

/** Screens a box has travelled since its top met the foot of the screen. */
export function travelled(top: number, screen: number): number {
  return (screen - top) / Math.max(1, screen);
}

/** The whole pass of a box, in screens: its top at the foot of the screen to its foot at the top. */
export function passOf(height: number, screen: number): number {
  return 1 + height / Math.max(1, screen);
}

/** The clock time of a point of the pass. */
export function timeAt(at: number, span: number): number {
  return clamp01(at / span) * PASS_MS;
}

/**
 * One step of the drawn point toward the scroll's, `dt` seconds on. Outside the pass nothing
 * changes, so the target is held just outside it: a part far away is not played through on its
 * way back. Close enough, it lands exactly, and the loop can stop.
 */
export function follow(shown: number, target: number, span: number, dt: number): number {
  const goal = Math.min(span + 0.02, Math.max(-0.02, target));
  const from = Math.min(span + 0.02, Math.max(-0.02, shown));
  const next = from + (goal - from) * (1 - Math.exp(-FOLLOW_RATE * Math.max(0, dt)));
  return Math.abs(goal - next) < 0.0005 ? goal : next;
}

/** Where the drawn point rests for a target: what `follow` lands on. */
export function restOf(target: number, span: number): number {
  return Math.min(span + 0.02, Math.max(-0.02, target));
}

/**
 * The keys of a line that rises out of its mask and, as its part leaves, goes on up out of it.
 * `inAt` and `outAt` are where each move starts; `dur` how long it takes, in screens.
 */
export function riseKeys(inAt: number, outAt: number, dur = 0.42, outDur = dur): Key[] {
  return [
    [inAt, { y: 108 }, EASE.out],
    [inAt + dur, { y: 0 }],
    [outAt, { y: 0 }, EASE.in],
    [outAt + outDur, { y: -108 }],
  ];
}

/**
 * The keys of a hairline that draws in from the left inside its mask and, as its part leaves, runs
 * on out to the right. The line only translates: its mask is what shows it growing.
 */
export function drawKeys(inAt: number, outAt: number, dur = 0.5, outDur = dur): Key[] {
  return [
    [inAt, { x: -101 }, EASE.inOut],
    [inAt + dur, { x: 0 }],
    [outAt, { x: 0 }, EASE.inOut],
    [outAt + outDur, { x: 101 }],
  ];
}
