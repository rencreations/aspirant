import type { CharacterData } from "../types";

export const ruby: CharacterData = {
  slug: "ruby",
  order: 3,
  name: "Ruby",
  aspirantName: "Mecha Maiden",
  jp: { script: "ルビー", romaji: "Rubī" },
  ageText: "15 to 19",
  birthday: "June 12",
  mbti: "ESFP",
  role: "Scythe fighter and programmer from Oro",
  weapon: "A great scythe with a dark navy blade edged in gold",
  partnerSlug: "angela",
  pair: "ruby-angela",
  side: "daybreak",
  palette: { primary: "#1E2A57", secondary: "#E0388E", glow: "#F2B83B", ink: "#0A0F24" },
  tagline: "She built a friend, then left the golden cage.",
  summary:
    "Ruby grew up as an heir on the planet Oro, where heirs may have no friends and no feelings. She learned to hide behind a calm face, and in secret she built Angela. She came to Dawnbreak with Oro's army, and she chose to stay.",
  sections: {
    personality: [
      "Calm and cool on the surface. It is a mask she learned by copying a grey tutor.",
      "Underneath, playful and full of life: she hums while she solders, drums her fingers and does voices.",
      "Clever with machines and code. Soon any lock would tell her which door would open.",
      "Fiercely independent. She will not be anyone's puppet.",
      "Takes responsibility. At her hearing she pleaded guilty and asked for no mercy.",
    ],
    appearance: [
      "Black and deep navy hair with straight bangs, fading at the ends to pink and golden orange.",
      "Her left eye is blue with a small star. Her right eye sits behind the Veil of Counsel, a white and gold visor.",
      "White and gold armour with a red neckerchief, a long golden sash and white mecha gauntlets.",
    ],
    fighting: [
      "Close combat with a huge scythe. When she swings it, it feels like a dance.",
      "Fast and precise: on the Day of the Breach she cut down six of the Marshal's guards alone.",
      "She fights with code as much as with a blade, and looks for the flaw in any system.",
    ],
    background: [
      "She is the daughter of one of Oro's nine Decision Makers, raised by the Rules of the Line: an heir shall not have friends.",
      "At five she found a rag doll with a pink wool head. Her father sent away the nursemaid who had been kind to it, and Ruby was told the doll had been burned.",
      "From the age of seven she wore the Veil of Counsel, which sent everything she saw to the Institute. She learned to fool it.",
      "In a secret workshop she built an android with a soft face and a cat-ear headset, and named her Angela, after that nursemaid.",
      "She met Lesley inside the Institute, told her where to cut, and asked her not to shoot Angela.",
    ],
    motivation: [
      "Freedom from Oro, and from the Rules that tried to make her a stone.",
      "To keep Angela safe, whatever it costs her.",
      "Never to be anyone's puppet again.",
    ],
    flaws: [
      "At first she told herself that Angela was only a tool.",
      "Keeps her feelings locked away and finds them hard to say.",
      "Plans alone and carries the risk alone.",
    ],
    relationships: [
      {
        slug: "angela",
        name: "Angela",
        text: "Her creation, her partner and her closest friend. Every day Ruby asks her the same question: does it hurt?",
      },
      {
        slug: null,
        entityId: "tetra",
        name: "Tetra",
        text: "The doll-sized twin she made for Angela, because she was not allowed to be Angela's friend herself.",
      },
      {
        slug: "lesley",
        name: "Lesley",
        text: "They met in a corridor inside Oro's Institute. Ruby did not raise the alarm, and Lesley later spoke for her.",
      },
      {
        slug: "change",
        name: "Chang'e",
        text: "Brought her very sweet tea after the Breach, and worked with her through the night to mend Tetra.",
      },
      {
        slug: null,
        name: "Her father",
        text: "A Decision Maker of Oro who built the Rules out of his own grief. His fate is not specified.",
      },
    ],
  },
  laterInStory: [
    {
      text: "In the last battle she finds a small gap in the Matrix and types one line into it: hold, wait. Nobody knows if it was read.",
      chapterId: "c60",
    },
    {
      text: "When the night is over, home means the Academy dormitory, with its beds, its kettle and its terrible green rug.",
      chapterId: "c60",
    },
  ],
  keyQuotes: [5, 19, 20, 24, 31, 40],
  inStory: {
    chapterIds: [
      "c29",
      "c33",
      "c34",
      "c35",
      "c36",
      "c37",
      "c38",
      "c39",
      "c40",
      "c42",
      "c43",
      "c44",
      "c46",
      "c54",
      "c60",
    ],
  },
};
