import type { CharacterData } from "../types";

export const change: CharacterData = {
  slug: "change",
  order: 6,
  name: "Chang'e",
  aspirantName: "Tech Tensai",
  jp: { script: "嫦娥", romaji: null },
  ageText: "Not specified",
  ageNote:
    "The author gives no confirmed age, only a range of 6 to 14. She is small, about as tall as Lesley's waist.",
  birthday: "January 23",
  mbti: "ENTP",
  role: "Chief Scientist, gadget and flight fighter",
  weapon: "The Crescent Moon, her own armour, and Mr. Bunny",
  partnerSlug: "lesley",
  pair: "lesley-change",
  side: "daybreak",
  palette: { primary: "#FF8FC7", secondary: "#3FD3B8", glow: "#A6F7E6", ink: "#24132F" },
  tagline: "Very small, very clever, and not a kid.",
  summary:
    "Chang'e is the Academy's Chief Scientist and its co-founder: very small, very clever and very proud. She discovered aspirant power, built the first core, and measures the coupling of every pair. Her robot friend, Mr. Bunny, goes everywhere with her.",
  sections: {
    personality: [
      "Brilliant and inventive. Imagination is her weapon.",
      "Proud of being grown-up, and cross when anyone treats her like a child.",
      "Plays with ideas and loopholes. She is never hiding, only observing.",
      "Fierce in her loyalty, and able to forgive.",
      "Notices everything, and keeps what she notices to herself when kindness needs it.",
    ],
    appearance: [
      "Very small, about as tall as Lesley's waist.",
      "Bright pink twin-tails with a green streak, fading to pale teal at the ends, and a headset shaped like rabbit ears.",
      "Large green eyes behind round glasses.",
      "A white lab coat with a teal collar and a translucent teal skirt.",
    ],
    fighting: [
      "Fights at range with gadgets she built herself.",
      "Rides the Crescent Moon, a flying board shaped like a crescent.",
      "Mr. Bunny can unfold into a giant the size of a house and carry her into battle.",
      "With Mr. Bunny and her, even one plus one is more than two.",
    ],
    background: [
      "She came to Terrinia as a very small child on a refugee convoy, with no parents, no papers and a tin wind-up rabbit.",
      "The two Chief Scientists of Selrick Base adopted her. She called them Mama and Papa, and the tin rabbit became Mr. Bunny.",
      "She built Lesley an artificial eye and a rifle for her birthday.",
      "She lost her parents the day the Base fell, and blamed Lesley for not being there. Years later, she forgave her.",
      "She discovered aspirant power, and with Lesley she founded Selrick Academy on the ruins of the Base.",
    ],
    motivation: [
      "That no child should have to watch their family die.",
      "To keep asking what is at the other end of the Enders' signal, as her parents wished to know.",
      "To protect everyone's aspirant power.",
    ],
    flaws: [
      "Impulsive. She once went out alone to fight the Enders in armour she had never tested.",
      "Held a grudge against Lesley for years.",
      "Touchy about her age and her size.",
      "Sometimes too sure of her inventions.",
    ],
    relationships: [
      {
        slug: "lesley",
        name: "Lesley",
        text: "Her Big Sis, her partner and her co-founder. Lesley once told her what a Big Sis does: she stays.",
      },
      {
        slug: null,
        entityId: "mr-bunny",
        name: "Mr. Bunny",
        text: "Her best friend, rebuilt from a tin rabbit. She will not let anyone take him away.",
      },
      {
        slug: null,
        name: "Her parents",
        text: "The two Chief Scientists of Selrick Base, who taught her mathematics and the science of the Enders. A stone in the Academy garden carries their names.",
      },
      {
        slug: "selena",
        name: "Selena",
        text: "Hired her for the research post, and later told her: I trust you.",
      },
      {
        slug: "vexana",
        name: "Vexana",
        text: "Measured her aspirant power as the deepest she had seen, and told her to find someone who could hold the other end.",
      },
    ],
  },
  laterInStory: [
    {
      text: "Her lecture on the Horizon and black holes gives Vexana an idea.",
      chapterId: "c45",
    },
    {
      text: "On graduation day she asks the Imperatrix, in front of the whole city, why she was spared.",
      chapterId: "c53",
    },
  ],
  keyQuotes: [1, 11, 12, 13, 15, 17],
  inStory: {
    chapterIds: [
      "c13",
      "c15",
      "c16",
      "c17",
      "c18",
      "c19",
      "c20",
      "c21",
      "c22",
      "c23",
      "c28",
      "c45",
      "c52",
      "c53",
      "c60",
    ],
  },
};
