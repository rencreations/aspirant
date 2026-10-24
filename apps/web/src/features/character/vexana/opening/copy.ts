/**
 * The words of the opening. Vexana speaks, in the first person, from what the canon gives her:
 * she hears the Enders hum, her father called her Sana, Guinevere found her in a broom cupboard
 * with a doughnut, and she stands twelve paces behind her. Plain words, short sentences.
 */
export interface Part {
  text: string;
  /** Set in the serif, in colour. */
  mark?: boolean;
}

/** The two rows of big text that run behind the card. */
export const MARQUEE: ReadonlyArray<readonly Part[]> = [
  [
    { text: "In the dark I " },
    { text: "listen", mark: true },
    { text: ". The Enders " },
    { text: "hum", mark: true },
    { text: ". " },
  ],
  [
    { text: "In the light I stand " },
    { text: "behind her", mark: true },
    { text: ". Twelve paces. " },
  ],
];

/** The closing message, one line each. */
export const STATEMENT: ReadonlyArray<readonly Part[]> = [
  [{ text: "I hear the Enders " }, { text: "hum", mark: true }, { text: "." }],
  [{ text: "I sit in the dark so " }, { text: "she", mark: true }, { text: " can shine." }],
  [{ text: "My father called me " }, { text: "Sana", mark: true }, { text: "." }],
  [{ text: "A doughnut found me in a broom cupboard." }],
  [{ text: "Now I stand twelve paces behind " }, { text: "her", mark: true }, { text: "." }],
  [{ text: "I am still " }, { text: "here", mark: true }, { text: "." }],
];

export const STATEMENT_PLAIN = STATEMENT.map((l) => l.map((p) => p.text).join("")).join(" ");
