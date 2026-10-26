/**
 * The story of the interactive drama, as a graph. Written by hand from the 21 official episode
 * videos of "Become The Aspirants | Interactive Drama" (see `scripts/vexana/drama.py`, `SOURCES`).
 *
 * The 21 episodes of the official tree are 13 different films: eight of them are the same film
 * posted under two or three ids (the picture and the sound are identical). Each film is one node
 * here, and `codes` lists the ids of the official tree it stands for. What differs between two
 * ids of the same film is the CHOICE that led to it, and that is kept: every choice has its own
 * label, tag and picture (the official thumbnail of the id it leads to carries the text of the
 * answer the viewer chose, which is where the labels come from).
 *
 * A film ends on a held picture with no choice drawn in it. The game puts the two choices over that
 * picture from `choiceAt` (see `drama.generated.ts`). An episode with no choices is an ending.
 */

export type ChapterNumber = 1 | 2 | 3 | 4 | 5 | 6;

interface DramaChoice {
  /** The small tag over the answer, as on the official card, for example "CHECK BADGE". */
  tag: string;
  /** The answer itself, as the official card shows it. */
  label: string;
  /** The id of the episode it leads to. */
  to: string;
  /** The official id (`yt-<code>.webp`) whose thumbnail is the card of this answer. */
  thumb: string;
}

export interface DramaNode {
  /** "1", "2A", "3B", ... the chapter number and the branch letter. */
  id: string;
  chapter: ChapterNumber;
  /** The ids of the official tree this film stands for. */
  codes: readonly string[];
  title: string;
  /** One or two short sentences about what happens. */
  summary: string;
  /** The file in `public/video/vexana/drama/` (without the extension). */
  file: string;
  /** Two answers, or none for an ending. */
  choices: readonly DramaChoice[];
  ending?: { title: string; kind: "good" | "hopeful" };
}

export const DRAMA_START = "1";

export const CHAPTERS: ReadonlyArray<{ number: ChapterNumber; title: string }> = [
  { number: 1, title: "Arrival" },
  { number: 2, title: "The Emblem" },
  { number: 3, title: "The Bond" },
  { number: 4, title: "The Test" },
  { number: 5, title: "The Storm" },
  { number: 6, title: "The Singularity" },
];

export const DRAMA_NODES: readonly DramaNode[] = [
  {
    id: "1",
    chapter: 1,
    codes: ["1"],
    title: "Arrival at Selrick",
    summary:
      "A new student arrives at Selrick Academy and hears of its ace duo, Guinevere and Vexana. A strange badge and a signal from the rooftop catch the eye.",
    file: "1",
    choices: [
      {
        tag: "CHECK BADGE",
        label: "This doesn't look like standard Academy gear?",
        to: "2A",
        thumb: "2A",
      },
      {
        tag: "CHECK ROOFTOP",
        label: "There's something happening over there!",
        to: "2B",
        thumb: "2B",
      },
    ],
  },
  {
    id: "2A",
    chapter: 2,
    codes: ["2A"],
    title: "The Emblem",
    summary:
      "Guinevere says the badge is an Emblem of Hope. She and Vexana made it together, as proof of their bond.",
    file: "2a",
    choices: [
      {
        tag: "CURIOUS INQUIRY",
        label: "This badge... it's an important token, isn't it?",
        to: "3A",
        thumb: "3A1",
      },
      { tag: "OFFER HELP", label: "Shall I help you maintain it?", to: "3B", thumb: "3B1" },
    ],
  },
  {
    id: "2B",
    chapter: 2,
    codes: ["2B"],
    title: "The Rooftop Signal",
    summary:
      "Angela, Ruby and Guinevere track an unstable energy signal. Ruby fears it is an Ender, and that it is a lure.",
    file: "2b",
    choices: [
      {
        tag: "SUPPORT GUINEVERE",
        label: "Vexana must be responding to you!",
        to: "3A",
        thumb: "3A2",
      },
      { tag: "WORRY FLASH", label: "Could it be a trap?", to: "3B", thumb: "3B2" },
    ],
  },
  {
    id: "3A",
    chapter: 3,
    codes: ["3A1", "3A2"],
    title: "Where They Met",
    summary:
      "Guinevere remembers how she and Vexana became partners. Her emblem still glows, and she is sure Vexana is waiting.",
    file: "3a",
    choices: [
      { tag: "SUPPORT ACTION", label: "Perhaps I can partner with you?", to: "4A", thumb: "4A1" },
      {
        tag: "GIVE ENCOURAGEMENT",
        label: "You will definitely find her!",
        to: "4B",
        thumb: "4B1",
      },
    ],
  },
  {
    id: "3B",
    chapter: 3,
    codes: ["3B1", "3B2"],
    title: "Alarm at the Singularity",
    summary:
      "Students report a dangerous signal from the Singularity. The emblem flashes, and Guinevere decides to go alone.",
    file: "3b",
    choices: [
      {
        tag: "TEAM REQUEST",
        label: "Teaming up is safer than going alone!",
        to: "4A",
        thumb: "4A2",
      },
      { tag: "HOLD THE REAR", label: "I'll handle things back here!", to: "4B", thumb: "4B2" },
    ],
  },
  {
    id: "4A",
    chapter: 4,
    codes: ["4A1", "4A2"],
    title: "The Partner Test",
    summary:
      "Guinevere tests the newcomer as a temporary partner. Layla judges the aim, and Guinevere admits she fears losing another partner.",
    file: "4a",
    choices: [
      { tag: "PROBING THE PAST", label: "Vexana... what happened?", to: "5A", thumb: "5A" },
      {
        tag: "RESPOND ACTIVELY",
        label: "Stop trying to handle everything yourself. Let me help.",
        to: "5C",
        thumb: "5C",
      },
    ],
  },
  {
    id: "4B",
    chapter: 4,
    codes: ["4B1", "4B2"],
    title: "Rescue Briefing",
    summary:
      "The Aspirants gather before a map of the Singularity. The Enders are mobilizing, and the team is ready to bring Vexana back.",
    file: "4b",
    choices: [
      {
        tag: "CONFIRM SUPPORT",
        label: "Roger that! Ground support standing by!",
        to: "6C",
        thumb: "6C1",
      },
      { tag: "SUGGEST RETREAT", label: "Too many enemies! Fall back!", to: "5B", thumb: "5B" },
    ],
  },
  {
    id: "5A",
    chapter: 5,
    codes: ["5A"],
    title: "The Argument",
    summary:
      "Guinevere admits she and Vexana quarreled the day Vexana vanished. Vexana had seen a doomed future, and Guinevere now sees she only meant to protect her.",
    file: "5a",
    choices: [
      {
        tag: "REAR GUARD",
        label: "Go find her! I'll cover you from behind.",
        to: "6A",
        thumb: "6A1",
      },
      {
        tag: "SIDE BY SIDE",
        label: "True partners stick together. I'm with you!",
        to: "6B",
        thumb: "6B1",
      },
    ],
  },
  {
    id: "5B",
    chapter: 5,
    codes: ["5B"],
    title: "Fall Back",
    summary:
      "The newcomer calls a retreat. Guinevere puts everything on the line and entrusts the academy to the newcomer.",
    file: "5b",
    choices: [
      {
        tag: "PROMISE TO PROTECT",
        label: "I'll guard the Academy until you return.",
        to: "6A",
        thumb: "6A2",
      },
      {
        tag: "DECLARATION OF FAITH",
        label: "The Ace Squad won't leave anyone behind!",
        to: "6C",
        thumb: "6C2",
      },
    ],
  },
  {
    id: "5C",
    chapter: 5,
    codes: ["5C"],
    title: "Into the Battle",
    summary:
      "Guinevere warns that this is real battle. An Ender strikes, and Vexana and Guinevere each try to shield the other.",
    file: "5c",
    choices: [
      {
        tag: "EMPHASIZE COOPERATION",
        label: "That's what partners do: we protect each other!",
        to: "6B",
        thumb: "6B2",
      },
      {
        tag: "RESTORE CONFIDENCE",
        label: "Of course, Aces never miss their mark!",
        to: "6C",
        thumb: "6C3",
      },
    ],
  },
  {
    id: "6A",
    chapter: 6,
    codes: ["6A1", "6A2"],
    title: "Witness Our Moment",
    summary:
      "Vexana believes there is no other choice. Guinevere answers that the choice is theirs together, and the two strike as partners.",
    file: "6a",
    choices: [],
    ending: { title: "Witness Our Moment", kind: "hopeful" },
  },
  {
    id: "6B",
    chapter: 6,
    codes: ["6B1", "6B2"],
    title: "A New Future",
    summary:
      "Guinevere will not let Vexana sacrifice herself. Their light destroys the Control Core, the Singularity disappears, and they stand together at sunset.",
    file: "6b",
    choices: [],
    ending: { title: "A New Future", kind: "good" },
  },
  {
    id: "6C",
    chapter: 6,
    codes: ["6C1", "6C2", "6C3"],
    title: "United Light",
    summary:
      "The whole squad stands behind Guinevere. They say that hope never dies and charge the Singularity together.",
    file: "6c",
    choices: [],
    ending: { title: "United Light", kind: "hopeful" },
  },
];

export function nodeById(id: string): DramaNode {
  const node = DRAMA_NODES.find((n) => n.id === id);
  if (!node) throw new Error(`No drama episode "${id}"`);
  return node;
}

export function isEnding(node: DramaNode): boolean {
  return node.choices.length === 0;
}
