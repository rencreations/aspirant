/**
 * The words of the opening. Vexana speaks, in the first person, in plain words anyone can follow:
 * she is quiet, she carries a weight nobody sees, she stands behind the person she loves so that
 * person can shine, and she is still here. Nothing in it needs the story to be understood.
 */
export interface Part {
  text: string;
  /** Set in the serif, in colour. */
  mark?: boolean;
}

/** The two rows of big text that run behind the card. */
export const MARQUEE: ReadonlyArray<readonly Part[]> = [
  [
    { text: "Quiet, but I " },
    { text: "notice", mark: true },
    { text: ". Heavy, but I " },
    { text: "carry", mark: true },
    { text: " it. " },
  ],
  [
    { text: "I stand " },
    { text: "behind", mark: true },
    { text: " you. And I am still " },
    { text: "here", mark: true },
    { text: ". " },
  ],
];

/** The closing message, one line each. */
export const STATEMENT: ReadonlyArray<readonly Part[]> = [
  [{ text: "I do not say much. I " }, { text: "notice", mark: true }, { text: " a lot." }],
  [{ text: "I carry a " }, { text: "weight", mark: true }, { text: " nobody sees." }],
  [{ text: "Being brave is not always " }, { text: "loud", mark: true }, { text: "." }],
  [{ text: "Sometimes it is standing " }, { text: "behind", mark: true }, { text: " someone." }],
  [{ text: "So " }, { text: "she", mark: true }, { text: " can walk ahead and shine." }],
  [{ text: "I am still " }, { text: "here", mark: true }, { text: "." }],
];

export const STATEMENT_PLAIN = STATEMENT.map((l) => l.map((p) => p.text).join("")).join(" ");
