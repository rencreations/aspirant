import type { CharacterData } from "../types";

export const fanny: CharacterData = {
  slug: "fanny",
  order: 1,
  name: "Fanny",
  aspirantName: "Blade of Kibou",
  jp: { script: "ファニー", romaji: "Fanī" },
  ageText: "17",
  birthday: "June 11",
  mbti: "ESTJ",
  role: "Dual-blade aerial fighter",
  weapon: "Twin cyan blades and a cable-gear rig whose two white cases open into wings",
  partnerSlug: "layla",
  pair: "fanny-layla",
  side: "daybreak",
  palette: { primary: "#F5862A", secondary: "#6A3FB5", glow: "#F2ECFF", ink: "#1E1430" },
  tagline: "A blade for hope, carried on a steel cable.",
  summary:
    "Fanny came to Selrick Academy from the Cadet Corps and took first place without seeming to try. She is warm, careful and polite, and she logs every flight in a black drill-book. Layla made her a rival first, and a partner after.",
  sections: {
    personality: [
      "Warm and polite, even to people who are rude to her.",
      "Careful and thorough. She logs every flight and answers for every rule she bends.",
      "Not competitive by nature. She trains to get stronger, not to take first place.",
      "Loves heights. Being up high makes her feel free.",
      "Keeps her worries to herself, and her brother most of all.",
    ],
    appearance: [
      "Bright orange hair in a high, spiky ponytail, red-orange at the tips, held by a grey and black mechanical clip.",
      "Clear green eyes and a gentle smile.",
      "A white shirt with a red ribbon tie, a purple-black bodice with gold buttons, and white mecha boots to the knee.",
      "Two long white cases at her hips, each as long as her leg, that open into wings when she flies.",
    ],
    fighting: [
      "Close to mid range with twin blades, and great speed in the air.",
      "Her cable-gear fires a grapple, hooks on and hauls her up. She built most of it herself, with an old engineer.",
      "She charges her cable with her own energy so that Layla can fire along it. The beam follows the line.",
      "She looks for the weak spot, such as the seam at an Ultra Ender's neck.",
    ],
    background: [
      "She and her elder brother Tigreal were orphaned together in the shelters. She was too small to remember their parents.",
      "She trained at the Cadet Corps under Sergeant Brandt before she transferred to the Academy.",
      "Her Resonance Trial gave a perfect resonance. She chose the designation Blade of Kibou: kibou is an old word from the hills for hope.",
      "Within a week she ranked first, ahead of Layla, and Layla named her a rival.",
      "Chang'e measured the highest coupling she had ever recorded between Fanny and Layla.",
    ],
    motivation: [
      "To stand beside her brother one day and fight as his equal.",
      "To protect Terrinia, and someday to leave it freely and see the wider world.",
      "To see a harbour with a hundred and seventeen lighthouses that sing in the wind.",
    ],
    flaws: [
      "Measures herself against her brother and fears she will never reach his level.",
      "Will fly where flying is banned, once she has filed the form and waited.",
      "Holds back so as not to outshine others, which can hurt them more than losing would.",
      "Rarely says what worries her.",
    ],
    relationships: [
      {
        slug: "layla",
        name: "Layla",
        text: "Rival first, partner after. Their pride and warmth do not cancel out. Their coupling is the highest the Academy has measured.",
      },
      {
        slug: null,
        entityId: "tigreal",
        name: "Tigreal",
        text: "Her elder brother, a front-line fighter of the Shield. Everything she trains for is to stand beside him.",
      },
      {
        slug: "lesley",
        name: "Lesley",
        text: "Her combat instructor. Sergeant Brandt sent Fanny to ask her about aspirant power.",
      },
      {
        slug: "change",
        name: "Chang'e",
        text: "Gave Fanny her Resonance Trial, and put her on Layla's team because of the numbers.",
      },
    ],
  },
  laterInStory: [
    {
      text: "On graduation day she leads the Aspirants into the northern ward and stands at her brother's left.",
      chapterId: "c54",
    },
    {
      text: "She teaches Angela to fly on a cable: it is about being willing to let go of the ground.",
      chapterId: "c54",
    },
    {
      text: "At dawn she sits on the gantry with Tigreal and plans a trip to the lighthouses.",
      chapterId: "c60",
    },
  ],
  keyQuotes: [2, 3, 8, 13, 17],
  inStory: { chapterIds: ["c02", "c03", "c30", "c31", "c32", "c40", "c42", "c54", "c56", "c60"] },
};
