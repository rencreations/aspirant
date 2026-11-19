/**
 * The clock of a section whose scenes are plays (`kernel/plays.ts`). A section with plays gets a
 * virtual `local` (`v`). The scenes of a choreography are written in beat time, a unit of their own
 * that does not depend on how many screens the section is given, so a section can be made longer or
 * shorter in its `index.ts` without moving a beat. `beatOf` turns `v` into beat time:
 *
 *  - inside the section (`v` from 0 to 1) it is `v * length`, where `length` is the beat time the
 *    plays cover;
 *  - in the lead (`v < 0`) and the tail (`v > 1`) the scroll goes on in real screens, so the joint
 *    with a neighbour that is not on plays moves at the speed of the page.
 *
 * `playsOf` writes the table of plays from the steps in beat time, so the thresholds are said in
 * screens after the section's start and the values in beat time. Pure: no DOM, no three. This file
 * does not import the registry, so a section's `index.ts` may import it.
 */
import type { HomePlay, PlayEase } from "./plays";

/** One play, in beat time: it fires `atScreens` after the section's start and ends at beat `to`. */
export interface BeatStep {
  readonly atScreens: number;
  readonly to: number;
  /** A clock play: its length. A zone: the length of the idle snap for the full traverse. */
  readonly seconds: number;
  readonly ease?: PlayEase;
  readonly back?: number;
  /**
   * With a span the step is a scroll ZONE (`kernel/scrub.ts`): the beats run from the previous
   * station to `to` while the scroll covers `spanScreens` screens from `atScreens`, up or down, with no
   * clock and no hold. The curve defaults to `linear`. Without it the step is a clock play.
   */
  readonly spanScreens?: number;
}

/**
 * The length in screens a section needs for these steps: the end of the last zone or the threshold of
 * the last clock play, plus `dwell` (the rest after it). So a section writes `screens: zoneLength(STEPS, 0.8)`
 * and moves with its steps.
 */
export function zoneLength(steps: readonly BeatStep[], dwell = 0): number {
  let end = 0;
  for (const s of steps) end = Math.max(end, s.atScreens + (s.spanScreens ?? 0));
  return end + dwell;
}

/** Beat time at the virtual `local` `v`: `length` beats across the section, real screens outside. */
export function beatOf(v: number, length: number, screens: number): number {
  if (v < 0) return v * screens;
  if (v > 1) return length + (v - 1) * screens;
  return v * length;
}

/**
 * The table of plays for a section that runs the beats `first` to `last`: `first` is the beat at the
 * section's start, and the beats of `to` are in the same unit. The section's `local` is 0 at `first`
 * and 1 at `last`, so `beatOf(v, last - first, screens) + first` is the beat time for `v`.
 */
export function playsOf(
  first: number,
  last: number,
  screens: number,
  steps: readonly BeatStep[],
): HomePlay[] {
  const span = last - first;
  let from = first;
  return steps.map((step) => {
    const zone = step.spanScreens !== undefined;
    const play: HomePlay = {
      at: step.atScreens / screens,
      from: (from - first) / span,
      to: (step.to - first) / span,
      seconds: step.seconds,
      ease: step.ease ?? (zone ? "linear" : "inOut"),
      ...(step.back === undefined ? {} : { back: step.back }),
      ...(step.spanScreens === undefined ? {} : { span: step.spanScreens / screens }),
    };
    from = step.to;
    return play;
  });
}

/** The beat time a section's `update` gets for the virtual `local` `v`, for beats `first` to `last`. */
export function beatFor(v: number, first: number, last: number, screens: number): number {
  return first + beatOf(v, last - first, screens);
}
