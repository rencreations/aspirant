/**
 * Moving through the dialogue of an episode. The film has a list of `marks`: the seconds at which a
 * line is fully on screen (the first is 0, the start of the film). Skipping goes to the next mark,
 * going back to the one before. After the last line the film holds a still picture and the choices
 * go over it, from `choiceAt`; an ending has no choices, so after its last line the next step is its
 * end.
 */

export interface MarkInfo {
  marks: readonly number[];
  choiceAt: number | null;
  duration: number;
}

export type Step =
  | { kind: "mark"; at: number }
  /** To the held picture where the choices are shown. */
  | { kind: "choices"; at: number }
  /** To the end of an ending film. */
  | { kind: "end"; at: number }
  /** Nowhere: the choices are already up, or the film is at its end. */
  | { kind: "none" };

/** A mark this close to the time counts as the time itself (a seek to a mark lands a frame off). */
const NEAR = 0.15;

/** The index of the mark of the line that is on screen at `t` (-1 before the first). */
export function markIndexAt(marks: readonly number[], t: number): number {
  let found = -1;
  for (let i = 0; i < marks.length; i++) {
    if ((marks[i] ?? Infinity) <= t + 0.05) found = i;
    else break;
  }
  return found;
}

export function nextStep(info: MarkInfo, t: number): Step {
  const { marks, choiceAt, duration } = info;
  const mark = marks.find((m) => m > t + NEAR && (choiceAt === null || m < choiceAt));
  if (mark !== undefined) return { kind: "mark", at: mark };
  if (choiceAt !== null) {
    return t < choiceAt - 0.05 ? { kind: "choices", at: choiceAt } : { kind: "none" };
  }
  return t < duration - 0.4 ? { kind: "end", at: Math.max(0, duration - 0.05) } : { kind: "none" };
}

/**
 * Back: to the start of the line on screen if it has been showing for a moment, else to the line
 * before it (the start of the film for the first one).
 */
export function previousMark(marks: readonly number[], t: number): number {
  const i = markIndexAt(marks, t);
  if (i < 0) return 0;
  const here = marks[i] ?? 0;
  if (t - here > 0.8) return here;
  return marks[Math.max(0, i - 1)] ?? 0;
}
