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
  readonly seconds: number;
  readonly ease?: PlayEase;
  readonly back?: number;
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
    const play: HomePlay = {
      at: step.atScreens / screens,
      from: (from - first) / span,
      to: (step.to - first) / span,
      seconds: step.seconds,
      ease: step.ease ?? "inOut",
      ...(step.back === undefined ? {} : { back: step.back }),
    };
    from = step.to;
    return play;
  });
}

/** The beat time a section's `update` gets for the virtual `local` `v`, for beats `first` to `last`. */
export function beatFor(v: number, first: number, last: number, screens: number): number {
  return first + beatOf(v, last - first, screens);
}
