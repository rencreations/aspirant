import type { CSSProperties } from "react";

import type { ReelCopy } from "../vexana/reel/reel-copy";

/** The title the site's player shows for the film. */
export const REEL_TITLE = "Guinevere, Daybreak Halo";

/** The words of 02, the film, for Guinevere. The film itself is the same one as Vexana's. */
export const REEL_COPY: ReelCopy = {
  chapter: { number: "02", label: "The film" },
  titleLines: [
    ["Daybreak", "Halo,"],
    ["Seen", "in", "Motion"],
  ],
  description:
    "A loud, bright girl who would not be bought. A partner she won with ten days of doughnuts. This is the film of Daybreak Halo, from the first note to the last.",
  playWords: ["Play", "Film"],
  watchLabel: "Play the film",
  stripLines: [
    "Play the film",
    "Daybreak Halo",
    "Selrick Academy",
    "Guinevere and Vexana",
    "Dawnbreak",
  ],
  readout: "Daybreak Halo",
};

/** Her colours for the section (the film's section reads these `--reel-*` properties). */
export const REEL_TONE = {
  "--reel-ink": "#24110e",
  "--reel-ink-2": "#3a1d14",
  "--reel-paper": "#fff6ec",
  "--reel-violet": "#f08a4b",
  "--reel-magenta": "#e1322e",
  "--reel-gold": "#f2b63d",
  "--reel-sky": "#7fc8f8",
} as CSSProperties;
