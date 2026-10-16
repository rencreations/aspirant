import type { CharacterData } from "../types";

export const obsidia: CharacterData = {
  slug: "obsidia",
  order: 9,
  name: "Obsidia",
  aspirantName: "Imperatrix Arashi",
  jp: { script: "アイーダ", romaji: "Aida" },
  ageText: "No human age (Ender)",
  birthday: "November 13",
  mbti: "INTJ",
  role: "Commander of the Enders",
  weapon: "A winged beast at the end of a long chain, and command of storm and lightning",
  partnerSlug: null,
  pair: "selena-obsidia",
  side: "storm",
  palette: { primary: "#B3122E", secondary: "#E2B04A", glow: "#FF5A86", ink: "#0B0709" },
  tagline: "The first Ender to ask why.",
  summary:
    "Obsidia is the first Ender who ever woke up. The Will of the Planet made her its commander, the Imperatrix, and she rules the Enders from the Storm Citadel. She is cold, calm and very clever, and curious about the people she is sent to break.",
  sections: {
    personality: [
      "Calm, cold and exact. She thinks many moves ahead.",
      "Curious about people, and about why they build windows.",
      "Lonely and bored after ages awake while the others sleep.",
      "Shows feeling only at an angle, and is surprised when she does.",
      "Has obeyed the Will all her life, out of long habit.",
    ],
    appearance: [
      "A tall, pale woman who floats just above the floor, because walking makes her feel small.",
      "Very long hair that fades from pink to rose to gold.",
      "Two different eyes: one violet-blue with a small white star, one pink-red with a diamond shape.",
      "A long black gown. One hand is black and clawed, so the Enders know her. The other is bare and pale.",
    ],
    fighting: [
      "Lightning comes to her hand like a cat. She commands storm and lightning.",
      "Her weapon is a beast's head at the end of a long chain of black plates.",
      "She directs the Ender fleets from the Storm Citadel.",
      "Her full Ender form is far larger, and older, than the lady in the gown.",
    ],
    background: [
      "The Enders sleep between purges. In one of those long sleeps, one Ender opened her eyes, and her first thought was: why?",
      "She asked the Matrix what comes after the last purge. It could not answer.",
      "The Will made her its commander and named her Imperatrix, an old word for a woman who commands armies.",
      "She sang to her own cells for years until they took a human shape. Then she grew humanoid Enders in the Chamber of Likenesses.",
      "She set one child down in the rain on Dawnbreak, to see what an Ender raised by humans would become.",
    ],
    motivation: [
      "To serve the Cycle, as she always has.",
      "To learn what comes after the end.",
      "Under it all, to see a different ending.",
    ],
    flaws: [
      "Sure that she can predict everything.",
      "Treats people as pieces on a board.",
      "Empty, and bored by her own power.",
      "Cannot bring herself to refuse the Will.",
    ],
    relationships: [
      {
        slug: "selena",
        name: "Selena",
        text: "Her creation and her pawn. Obsidia watched her grow up for years, and did not pull the string.",
      },
      {
        slug: null,
        entityId: "will-of-the-planet",
        name: "The Will of the Planet",
        text: "The mind she serves. She is its awakened commander, and the one who asks questions.",
      },
      {
        slug: "change",
        name: "Chang'e",
        text: "On the night Selrick Base fell, she ordered that one small child on the rubble was not to be touched.",
      },
    ],
  },
  laterInStory: [
    {
      text: "She teaches Vexana a board game in a small garden at the top of the Citadel.",
      chapterId: "c50",
    },
    {
      text: "Before the final purge, she leaves a flaw in the Matrix's plan, no wider than a hair.",
      chapterId: "c51",
    },
    {
      text: "She duels Selena high above Dawnbreak. How it ends is left open.",
      chapterId: "c59",
    },
  ],
  forms: {
    normal:
      "A pale lady in a long black gown, with hair from pink to gold, two different eyes and one clawed hand.",
    ender:
      "Tall, silver and violet, like a lily made of knives, with huge butterfly wings of magenta and gold. A black disc turns in each wing.",
  },
  keyQuotes: [3, 12, 14, 16, 20, 37],
  inStory: {
    chapterIds: [
      "i-far-above-1",
      "c12",
      "c18",
      "c25",
      "c26",
      "c27",
      "c36",
      "i-far-above-2",
      "c48",
      "c50",
      "c51",
      "c59",
    ],
  },
};
