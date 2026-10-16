import type { CharacterData } from "../types";

export const selena: CharacterData = {
  slug: "selena",
  order: 10,
  name: "Selena",
  aspirantName: "Silverbolt Raiko",
  jp: { script: "セリナ", romaji: "Serina" },
  ageText: "19",
  birthday: "June 18",
  mbti: "ENTP",
  role: "Science Division mechanic and Ender-tech fighter",
  weapon: "Silverbolt, a dragon-like mecha she built from Ender plates. Only she can make it move.",
  partnerSlug: null,
  pair: "selena-obsidia",
  side: "daybreak",
  palette: { primary: "#A6DCFF", secondary: "#C7D0DD", glow: "#8B5CF6", ink: "#0D1424" },
  tagline: "Even on the path to destruction, the scenic route.",
  summary:
    "Selena is the Academy's best young mechanic, with red eyes, a lazy smile and a friend for everyone. Karina Voss found her in the rain as a small child and raised her above a bakery. She built Silverbolt, a mecha nobody else can move.",
  sections: {
    personality: [
      "Playful, lazy-smiling and quick, with a joke for every tight spot.",
      "Cannot stand being controlled.",
      "Learned to smile by copying people, until the smile became real.",
      "Fond of chaos, and very good in it.",
      "Lonelier than she lets anyone see.",
    ],
    appearance: [
      "Very long pale gold hair with blue-violet strands, and a pink heart-shaped clip.",
      "Bright red eyes, pointed ears, small sharp teeth and two small red horns.",
      "In her combat suit: glossy black, with silver-blue shoulder plates and violet-blue armoured boots.",
    ],
    fighting: [
      "She fights with Silverbolt, a dragon of white-silver metal with blue gem eyes.",
      "Silverbolt can fold into two crescent blades that circle her like moons.",
      "She can catch lightning in her palm and ride it.",
      "She can turn a leash into a handle: a pull works both ways.",
    ],
    background: [
      "Karina Voss, a rescue worker, found her at Hollin Reach: a barefoot, silent child of about two, standing in the rain.",
      "She chose her own name from Karina's picture-book, about a girl in red boots who carries a lantern home through a storm.",
      "As a child she shared a honey-cake with a girl in her father's cap. That girl was Lesley.",
      "She came to the Academy about the research post, and Chang'e hired her.",
      "Her secret: she is an Ender, born in human form, and Obsidia made her.",
    ],
    motivation: [
      "Freedom to choose her own way.",
      "To keep the life she loves at the Academy.",
      "To come home to the lit window, however long the road.",
    ],
    flaws: [
      "Puts herself first, or says she does.",
      "Lives a double life and lies easily.",
      "Overconfident and reckless.",
      "Hides her loneliness behind jokes.",
    ],
    relationships: [
      {
        slug: "obsidia",
        name: "Obsidia",
        text: "Her creator, whom she calls Mother and refuses. They were made so alike.",
      },
      {
        slug: null,
        entityId: "karina-voss",
        name: "Karina Voss",
        text: "The rescue worker who picked her up in the rain and raised her. Selena chose her, and calls her Mum.",
      },
      {
        slug: "change",
        name: "Chang'e",
        text: "Her chief in the lab. Chang'e has known what she is for a long time, and told her: I trust you.",
      },
      {
        slug: "lesley",
        name: "Lesley",
        text: "They met as children by a lake. Years later Selena tells her, quietly: I pulled your blanket up once.",
      },
      {
        slug: "guinevere",
        name: "Guinevere",
        text: "Selena taught her how to tune the crystal in the Emblem of Hope: listen to it, do not grip it.",
      },
    ],
  },
  laterInStory: [
    {
      text: "She lends Vexana a needle at Underhill, in return for a story when it is over.",
      chapterId: "c50",
    },
    {
      text: "On graduation day she refuses Obsidia from the old bell tower and rides lightning to the Storm Citadel.",
      chapterId: "c58",
    },
    {
      text: "How her duel with Obsidia ends is left open. Karina keeps a lamp lit on the bell tower.",
      chapterId: "c60",
    },
  ],
  forms: {
    normal:
      "Her combat suit: glossy black with silver-blue shoulder plates, pale gold hair, red eyes, pointed ears, fangs and small red horns.",
    ender:
      "Silver plate flows over the black suit, a helm closes over her face, pink blades spring from her forearms, and four black and gold blade-wings wheel round her.",
  },
  keyQuotes: [1, 14, 18, 29, 43, 44],
  inStory: {
    chapterIds: [
      "c08",
      "c10",
      "c11",
      "c12",
      "c22",
      "c23",
      "c27",
      "c28",
      "c50",
      "c52",
      "c53",
      "c58",
      "c59",
    ],
  },
};
