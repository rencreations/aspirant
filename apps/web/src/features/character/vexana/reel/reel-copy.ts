/** The words of the film section. The controller reads the strip lines and the corner readout. */
export interface ReelCopy {
  chapter: { number: string; label: string };
  /** The heading as two lines of words. The first line has two words (the controller leans on it). */
  titleLines: ReadonlyArray<readonly string[]>;
  description: string;
  cta: { label: string; href: string };
  /** The two words either side of the play button. */
  playWords: readonly [string, string];
  watchLabel: string;
  /** The strips above and below the big picture take turns with these. */
  stripLines: readonly string[];
  /** The line the corner readout starts on. */
  readout: string;
}

export const REEL_COPY: ReelCopy = {
  chapter: { number: "02", label: "The film" },
  titleLines: [
    ["Twilight", "Star,"],
    ["Seen", "in", "Motion"],
  ],
  description:
    "A quiet girl who can hear the Enders hum. A partner who found her in a broom cupboard, with a doughnut. This is the film of Twilight Star, from the first note to the last.",
  cta: { label: "Read her story", href: "/character/vexana/story/academic/" },
  playWords: ["Play", "Film"],
  watchLabel: "Play the film",
  stripLines: [
    "Play the film",
    "Twilight Star",
    "Selrick Academy",
    "Vexana and Guinevere",
    "Dawnbreak",
  ],
  readout: "Twilight Star",
};
