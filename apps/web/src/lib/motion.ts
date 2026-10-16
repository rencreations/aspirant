/**
 * Motion tokens, mirrored from the CSS variables in styles/tokens.css.
 * Daybreak motion is springy and warm; Storm motion is slow and heavy.
 */

/** Cubic bezier control points, usable with Motion (`transition={{ ease: easings.out }}`). @public */
export const easings = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.65, 0, 0.35, 1],
  heavy: [0.83, 0, 0.17, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** GSAP ease names that match the curves above. @public */
export const gsapEase = {
  out: "expo.out",
  in: "power3.in",
  inOut: "power3.inOut",
  heavy: "power4.inOut",
  spring: "back.out(1.7)",
  none: "none",
} as const;

/** Durations in seconds (GSAP, Motion). @public */
export const durations = {
  instant: 0.09,
  fast: 0.16,
  base: 0.26,
  slow: 0.42,
  slower: 0.7,
  epic: 1.1,
} as const;

/** @public */
export type DurationName = keyof typeof durations;

/** Durations in milliseconds (timers, Web Animations). @public */
export const durationsMs = Object.fromEntries(
  Object.entries(durations).map(([k, v]) => [k, Math.round(v * 1000)]),
) as Record<DurationName, number>;

/** Spring presets for Motion and for the hand-rolled springs in components. */
export const springs = {
  /** Frames tilting, magnetic buttons. */
  soft: { stiffness: 170, damping: 18, mass: 1 },
  /** Small UI that snaps into place. */
  snappy: { stiffness: 420, damping: 30, mass: 1 },
  /** Storm side: slow and heavy. */
  heavy: { stiffness: 90, damping: 20, mass: 1.4 },
} as const;

/** CSS `var()` reference for an easing token, for inline styles. @public */
export function cssEase(name: keyof typeof easings | "spring"): string {
  const map = { out: "out", in: "in", inOut: "in-out", heavy: "heavy", spring: "spring" } as const;
  return `var(--ease-${map[name]})`;
}

/**
 * Advance a critically-damped-ish spring one step. Mutates and returns `state`.
 * Use inside rAF loops: `step(state, target, dt, springs.soft)`.
 */
export function springStep(
  state: { x: number; v: number },
  target: number,
  dt: number,
  config: { stiffness: number; damping: number; mass: number } = springs.soft,
): { x: number; v: number } {
  // Sub-step for stability when frames drop.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = Math.min(dt, 0.1) / steps;
  for (let i = 0; i < steps; i++) {
    const force = -config.stiffness * (state.x - target) - config.damping * state.v;
    state.v += (force / config.mass) * h;
    state.x += state.v * h;
  }
  return state;
}
