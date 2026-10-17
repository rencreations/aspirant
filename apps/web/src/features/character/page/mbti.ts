/**
 * The four MBTI letters spelled out. This is the meaning of the code itself, not a reading
 * of the character: no strengths, percentages or type nicknames.
 */
const AXES = [
  ["E", "Extraverted", "I", "Introverted"],
  ["S", "Sensing", "N", "Intuitive"],
  ["T", "Thinking", "F", "Feeling"],
  ["J", "Judging", "P", "Perceiving"],
] as const;

export interface MbtiAxis {
  readonly left: { readonly letter: string; readonly word: string };
  readonly right: { readonly letter: string; readonly word: string };
  /** Which pole the type takes. */
  readonly pick: "left" | "right";
}

/** The four axes of a code such as "ENTJ", with the chosen pole of each. */
export function mbtiAxes(code: string): MbtiAxis[] {
  const letters = code.toUpperCase().split("");
  return AXES.map(([l, lw, r, rw], i) => ({
    left: { letter: l, word: lw },
    right: { letter: r, word: rw },
    pick: letters[i] === r ? "right" : "left",
  }));
}

/** "Extraverted, Intuitive, Thinking, Judging". */
export function mbtiMeaning(code: string): string {
  return mbtiAxes(code)
    .map((a) => (a.pick === "left" ? a.left.word : a.right.word))
    .join(", ");
}
