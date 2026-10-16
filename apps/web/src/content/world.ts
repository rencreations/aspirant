/**
 * World data for the Story page: where you are, the Cycle, the hierarchy, coupling scores,
 * before and after, the time order, the open questions and the glossary.
 *
 * Every `quote` is the story's own text, copied exactly from `short-v2.md` (with the dash fix),
 * and the content tests check each one against the chapter it names. Every `text` is our own
 * wording of what the story says. Nothing here adds lore.
 */
import { pairs, type Pair } from "./pairs";
import { storyIndex } from "./story-index.generated";
import type { OpenQuestion, TimeOrderRow, WhoRow, AlsoRow, WordToKnow } from "./story-types";
import type { ChapterId, PairId } from "./types";

export { pairs, type Pair };

export interface PlaceCard {
  /** Glossary entity id. */
  readonly entityId: string;
  readonly name: string;
  readonly line: string;
  readonly chapterIds: readonly ChapterId[];
}

/** "Where you are": the four things a newcomer needs first. */
export const whereYouAre: readonly PlaceCard[] = [
  {
    entityId: "dawnbreak",
    name: "Dawnbreak",
    line: "A young planet, green and bright, with a blue lake and a wide sea.",
    chapterIds: ["c11", "c24"],
  },
  {
    entityId: "terrinia",
    name: "Terrinia",
    line: "The last great city left on Dawnbreak, built around a lake that opens into the sea.",
    chapterIds: ["c13"],
  },
  {
    entityId: "selrick-academy",
    name: "Selrick Academy",
    line: "The school that teaches young women to fight the Enders, built where Selrick Base once stood.",
    chapterIds: ["c22"],
  },
  {
    entityId: "defence-sphere",
    name: "The Defence Sphere",
    line: "A lattice of glowing hexagons over Terrinia, like a roof of glass. It keeps out the Enders.",
    chapterIds: ["c13"],
  },
];

/** The places index (hex cards). */
export const places: readonly PlaceCard[] = [
  {
    entityId: "gantry",
    name: "The gantry",
    line: "Layla's secret base, seventy metres up the Academy tower. On a clear morning you can watch the sun rise out of the sea.",
    chapterIds: ["c01", "c03", "c46", "c60"],
  },
  {
    entityId: "tanners-row",
    name: "Tanner's Row",
    line: "The poorest street of the lower terraces, with a thousand small lit windows. Layla's mother keeps a stall there.",
    chapterIds: ["c01", "c23", "c60"],
  },
  {
    entityId: "crown-heights",
    name: "Crown Heights",
    line: "A green hill above the city, where Guinevere grew up in a house that was never a home.",
    chapterIds: ["c04"],
  },
  {
    entityId: "harbour-front",
    name: "Harbour Front",
    line: "The quays and sea-wall, where Guinevere and Vexana held the line for forty-one minutes.",
    chapterIds: ["c09", "c41", "c44"],
  },
  {
    entityId: "bell-tower",
    name: "The bell tower",
    line: "An old sandstone tower with two hundred and fourteen steps and one bell, rung once a year on the first day of winter.",
    chapterIds: ["c31", "c58", "c60"],
  },
  {
    entityId: "underhill",
    name: "Underhill",
    line: "A black market in forgotten cellars under the lower terraces.",
    chapterIds: ["c50"],
  },
  {
    entityId: "valemont",
    name: "Valemont",
    line: "Lesley's home town in the green hills, where the first catastrophe found her family.",
    chapterIds: ["c11", "c12"],
  },
  {
    entityId: "hollin-reach",
    name: "Hollin Reach",
    line: "A small river town. Some years before 978, a strange storm scorched its north end into black glass.",
    chapterIds: ["c27"],
  },
  {
    entityId: "dorado",
    name: "Dorado",
    line: "Oro's capital, under a glass dome, where the sun comes up at six because it is ordered to.",
    chapterIds: ["c33", "c35", "c38"],
  },
];

export interface CycleStage {
  readonly id: "grow" | "catastrophe" | "embers" | "rebuild";
  readonly title: string;
  readonly text: string;
  readonly quote: string;
  readonly chapterId: ChapterId;
}

/** The Cycle, as Chapter 24 tells it. */
export const cycle: {
  readonly quote: string;
  readonly chapterId: ChapterId;
  readonly stages: readonly CycleStage[];
} = {
  quote:
    "This was the Cycle. A world grows too advanced. A catastrophe comes. Most of it is destroyed, and a few embers are spared. The survivors rebuild. Then it happens again.",
  chapterId: "c24",
  stages: [
    {
      id: "grow",
      title: "A world grows",
      text: "A world builds fast and grows too advanced. When one world races ahead of the others, the web of worlds starts to tear.",
      quote: "A world grows too advanced.",
      chapterId: "c24",
    },
    {
      id: "catastrophe",
      title: "A catastrophe comes",
      text: "The Enders come down through portals torn in the air and break part of that world. They feel no hate. They were made to purge.",
      quote: "A catastrophe comes.",
      chapterId: "c24",
    },
    {
      id: "embers",
      title: "Embers are spared",
      text: "A few cities and families are left on purpose: people who remember how to build.",
      quote: "Most of it is destroyed, and a few embers are spared.",
      chapterId: "c24",
    },
    {
      id: "rebuild",
      title: "The survivors rebuild",
      text: "The Matrix calls the Enders back, and they sleep. The survivors build again, until a world grows too advanced once more.",
      quote: "The survivors rebuild. Then it happens again.",
      chapterId: "c24",
    },
  ],
};

export interface EnderKind {
  readonly name: string;
  readonly entityId?: string;
  readonly text: string;
  readonly chapterId: ChapterId;
}

export interface HierarchyLayer {
  readonly id: "will" | "matrix" | "obsidia" | "enders" | "core";
  readonly title: string;
  /** One word for the diagram: the mind, the body, the commander, the hands, a device. */
  readonly role: string;
  readonly entityId: string;
  readonly text: string;
  readonly chapterIds: readonly ChapterId[];
  readonly kinds?: readonly EnderKind[];
  readonly note?: string;
}

/** The hierarchy of the Enders, from the mind down to the device. */
export const hierarchy: readonly HierarchyLayer[] = [
  {
    id: "will",
    title: "The Will of the Planet",
    role: "The mind",
    entityId: "will-of-the-planet",
    text: "Born when the Twilight Orb broke and its energy woke in the dark between the stars. It does not hate. It wants balance, and it resets worlds that grow too fast.",
    chapterIds: ["c24", "c48"],
  },
  {
    id: "matrix",
    title: "The Mother Matrix",
    role: "The body",
    entityId: "mother-matrix",
    text: "A vast, cold web hidden in the void. It turns the Will's thoughts into orders, grows the Enders, and calls them home when the work is done.",
    chapterIds: ["c24", "c51", "c53"],
  },
  {
    id: "obsidia",
    title: "Obsidia",
    role: "The commander",
    entityId: "obsidia",
    text: "The first Ender to wake. The Will made her its Imperatrix. She commands the fleets from the Storm Citadel, and while the others sleep, she stays awake.",
    chapterIds: ["c25", "c26", "c51"],
  },
  {
    id: "enders",
    title: "The Enders",
    role: "The hands",
    entityId: "enders",
    text: "Living weapons grown by the Matrix, with dark armour and violet fire in their veins. They feel no hate, and they obey the orders they are given.",
    chapterIds: ["c24"],
    kinds: [
      {
        name: "Ultra Enders",
        entityId: "ultra-enders",
        text: "The biggest, taller than houses. Each one has a seam at the neck.",
        chapterId: "c32",
      },
      {
        name: "Wardens",
        entityId: "wardens",
        text: "They carry a device in the chest and pass down orders from far away.",
        chapterId: "c36",
      },
      {
        name: "Hunters",
        entityId: "hunters",
        text: "Long black darts with one amber eye. They hang above a fight and fire down.",
        chapterId: "c58",
      },
      {
        name: "The Guardian",
        entityId: "guardian",
        text: "A giant made by the Will long ago. He obeys the voice that holds him while his golden halo burns.",
        chapterId: "c50",
      },
      {
        name: "Humanoid Enders",
        text: "Obsidia's experiments, grown in vats in the Chamber of Likenesses. Most of them did not live.",
        chapterId: "c26",
      },
    ],
    note: "The canon notes also name Soldiers, Heavy-class and Blades among the ordinary kinds.",
  },
  {
    id: "core",
    title: "The Ender Control Core",
    role: "A device",
    entityId: "ender-control-core",
    text: "Not a being. A crystal that turns orders into the Enders' own language, so its holder can command ordinary Enders. It cannot bind Obsidia. The Will took it back into its own dark void. Where it is now, and whether it can be broken, are left open.",
    chapterIds: ["c28", "c36", "c37", "c42", "c45"],
  },
];

export interface CouplingScore {
  readonly pair: PairId;
  readonly label: string;
  /** A number where the story gives one, else `null`. */
  readonly value: number | null;
  /** The score as the story puts it. */
  readonly display: string;
  readonly quote: string;
  readonly chapterId: ChapterId;
}

/** Every coupling score the story gives, in reading order. */
export const couplingScores: readonly CouplingScore[] = [
  {
    pair: "fanny-layla",
    label: "The pair system notice",
    value: null,
    display: "Squared, then squared again",
    quote:
      "In a good pair, the output is not doubled. It is squared. In the best pair I have ever measured, it was squared again.",
    chapterId: "c03",
  },
  {
    pair: "guinevere-vexana",
    label: "Registration in the chapel",
    value: 1.62,
    display: "1.62",
    quote: "It is the second highest I have measured. Only Layla and Fanny have scored higher.",
    chapterId: "c07",
  },
  {
    pair: "fanny-layla",
    label: "A Tuesday in April",
    value: 2.1,
    display: "2.1",
    quote: "Their coupling score was 2.1. It was the highest in the school.",
    chapterId: "c08",
  },
  {
    pair: "fanny-layla",
    label: "After the Team B3 drill",
    value: null,
    display: "Point two to point four",
    quote: "Your coupling rose from point two to point four when she cried.",
    chapterId: "c30",
  },
  {
    pair: "fanny-layla",
    label: "Firing along the cable",
    value: 2,
    display: "Two point oh, then off the scale",
    quote: "The coupling hit two point oh. Then it went off the scale!",
    chapterId: "c40",
  },
  {
    pair: "guinevere-vexana",
    label: "The harbour front",
    value: null,
    display: "Off the scale",
    quote: "In the command room, far away, Chang'e cried that the score was off the scale.",
    chapterId: "c41",
  },
];

/** The two measured scores the coupling lab uses: 2.1 and 1.62. */
export const couplingLab: ReadonlyArray<{ readonly pair: PairId; readonly value: number }> = [
  { pair: "fanny-layla", value: 2.1 },
  { pair: "guinevere-vexana", value: 1.62 },
];

export interface ContrastSide {
  readonly headline: string;
  readonly quote: string;
  readonly chapterId: ChapterId;
}

export interface Contrast {
  readonly id: string;
  readonly place: string;
  readonly before: ContrastSide;
  readonly after: ContrastSide;
}

/** Before and after, from the story's own words. Headlines are ours or chapter titles. */
export const contrasts: readonly Contrast[] = [
  {
    id: "dawnbreak-978",
    place: "Dawnbreak",
    before: {
      headline: "Dawnbreak, 978: a peaceful world",
      quote:
        "In those days, Dawnbreak was a young, bright world. Its people built fast. They had tall towers and flying machines. There was no Defence Sphere over Terrinia then. Nobody had ever heard the word Ender.",
      chapterId: "c11",
    },
    after: {
      headline: "That was before.",
      quote:
        "It was the year 978. The first catastrophe had begun, and the sky of Dawnbreak began to scream.",
      chapterId: "c11",
    },
  },
  {
    id: "first-light",
    place: "Dawnbreak",
    before: {
      headline: "First Light",
      quote:
        "Dawnbreak had a festival called First Light. At dusk, people set paper lanterns on the water and made a wish. Then the sea looked like a field of fallen stars.",
      chapterId: "c11",
    },
    after: {
      headline: "The ninth of September",
      quote: "The night of the ninth of September, 978.",
      chapterId: "c12",
    },
  },
  {
    id: "oro",
    place: "Oro",
    before: {
      headline: "The Planet of Gold",
      quote:
        "Oro's capital, Dorado, lay under a huge glass dome. Every morning at six, amber lamps round the rim began to glow, and golden light fell on the streets. It looked like sunshine. It was not.",
      chapterId: "c33",
    },
    after: {
      headline: "The Cleansing of Oro",
      quote:
        "Dome after dome fell. The Enders walked out of the storm, black and gold and taller than towers. Oro sent in the Legion, but it was not a battle. It was a harvest. Millions died.",
      chapterId: "c36",
    },
  },
  {
    id: "oro-sky",
    place: "Oro",
    before: {
      headline: "Seas, forests and a blue sky",
      quote: "Long ago, it had seas, forests and a blue sky.",
      chapterId: "c33",
    },
    after: {
      headline: "Thin and brown",
      quote:
        "The air outside the Domes was thin and brown, and the planet was running out of food and fuel.",
      chapterId: "c33",
    },
  },
  {
    id: "graduation",
    place: "Selrick Academy",
    before: {
      headline: "Graduation day",
      quote: "The morning of the ceremony was bright. It was the first week of September.",
      chapterId: "c52",
    },
    after: {
      headline: "All worlds will be weighed",
      quote: "All worlds will be weighed.",
      chapterId: "c53",
    },
  },
];

/** The three questions the story leaves open, word for word from its last pages. */
export const openQuestions: readonly OpenQuestion[] = storyIndex.backMatter.openQuestions.items;

/** The story in time order, from the back matter. Chapter ids are in the order printed. */
export const timeOrder: readonly TimeOrderRow[] = storyIndex.backMatter.timeOrder.rows;

/** "Words to know", from the back matter. */
export const wordsToKnow: readonly WordToKnow[] = storyIndex.backMatter.wordsToKnow.items;

/** "Now you know: who is who", from the back matter. */
export const whoIsWho: { readonly rows: readonly WhoRow[]; readonly also: readonly AlsoRow[] } =
  storyIndex.backMatter.whoIsWho;
