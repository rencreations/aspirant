/**
 * The words of the opening. Guinevere speaks, in the first person, in plain words anyone can
 * follow: she is loud and she cares, nobody ever asked what she wanted, someone called her strong,
 * and now she goes in front so that both of them can shine. Nothing in it needs the story to be
 * understood.
 */
export interface Part {
  text: string;
  /** Set in the serif, in colour. */
  mark?: boolean;
}

/** The two rows of big text that run behind the card. */
export const MARQUEE: ReadonlyArray<readonly Part[]> = [
  [
    { text: "Loud, but I " },
    { text: "care", mark: true },
    { text: ". Stubborn, but I " },
    { text: "stay", mark: true },
    { text: ". " },
  ],
  [
    { text: "I go in " },
    { text: "front", mark: true },
    { text: ". And I never let " },
    { text: "go", mark: true },
    { text: ". " },
  ],
];

/** The closing message, one line each. */
export const STATEMENT: ReadonlyArray<readonly Part[]> = [
  [{ text: "I am not " }, { text: "quiet", mark: true }, { text: ". I never learned how." }],
  [{ text: "Nobody asked what I " }, { text: "wanted", mark: true }, { text: "." }],
  [{ text: "So I learned to ask for it " }, { text: "myself", mark: true }, { text: "." }],
  [{ text: "Then one girl said I was " }, { text: "strong", mark: true }, { text: "." }],
  [{ text: "Now I go in " }, { text: "front", mark: true }, { text: ", and she stands with me." }],
  [{ text: "I will not let go until " }, { text: "dawn", mark: true }, { text: "." }],
];

export const STATEMENT_PLAIN = STATEMENT.map((l) => l.map((p) => p.text).join("")).join(" ");
