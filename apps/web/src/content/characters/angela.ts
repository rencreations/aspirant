import type { CharacterData } from "../types";

export const angela: CharacterData = {
  slug: "angela",
  order: 4,
  name: "Angela",
  aspirantName: "Cyber Cherubin",
  jp: { script: "アンジェラ", romaji: "Anjera" },
  ageText: "No human age (android)",
  birthday: "March 13",
  mbti: "INFP",
  role: "Combat android and shield support",
  weapon: "Her own combat body, and a shield she raises with Tetra",
  partnerSlug: "ruby",
  pair: "ruby-angela",
  side: "daybreak",
  palette: { primary: "#FFB28C", secondary: "#E23A92", glow: "#62E8F6", ink: "#2A1422" },
  tagline: "Learning what warmth means, one sunrise at a time.",
  summary:
    "Angela is the android Ruby built in secret on Oro, with a small pump for a heart. She is gentle, curious and braver than she knows. Oro made her to be a weapon, and she chose to be a person.",
  sections: {
    personality: [
      "Gentle, polite and cheerful, with a careful, formal way of speaking.",
      "Curious about everything. The world is full of things she wants to learn.",
      "Learning her feelings one at a time: warmth, loneliness, grief.",
      "Quietly brave. She takes on the risk herself if it helps others.",
      "Hears far more than most, from a frightened city to a voice in the sky.",
    ],
    appearance: [
      "Short peach hair with blunt bangs, and a white and magenta headset shaped like cat ears.",
      "Large blue eyes. When an outside command takes hold of her, they turn magenta.",
      "A white high-collared jacket with small magenta stars, pink petal-shaped waist armour, and white mecha legs with magenta fins.",
      "Tetra, a doll-sized twin of Angela with yellow eyes, floats at her shoulder.",
    ],
    fighting: [
      "Raises a shield of gold and pink light with two cat ears on top, together with Tetra.",
      "In a fight she puts herself between harm and other people.",
      "She protects and supports more than she strikes.",
    ],
    background: [
      "Ruby built her in a cradle of cyan light at the top of a forgotten tower. Her first words were: what does hurt mean?",
      "The Institute took away her pain to make her a better soldier. So every day, Ruby asks her if it hurts.",
      "Her friends in the barracks were older prototypes: Pip, Corvin and Daisy.",
      "Her first sunrise was a false one, in a garden under hexagon glass. Then Ruby showed her the real one. She liked the real one better.",
      "After the Breach, a hearing set her ninety days of work in Ruby's care, with a rider that she be called Miss in all papers.",
    ],
    motivation: [
      "To protect her friends, and never again to be used to hurt anyone.",
      "To understand what she feels.",
      "To stay with Ruby, and with Tetra.",
    ],
    flaws: [
      "Afraid of being left alone, or left behind.",
      "Slow to believe she is accepted as she is.",
      "Takes the blame onto herself, even for what she did not choose.",
    ],
    relationships: [
      {
        slug: "ruby",
        name: "Ruby",
        text: "Her maker and best friend. Angela taught Ruby that a friend is someone who stays.",
      },
      {
        slug: null,
        entityId: "tetra",
        name: "Tetra",
        text: "Her first friend: a tiny twin who chirps instead of speaking.",
      },
      {
        slug: null,
        entityId: "pip",
        name: "Pip",
        text: "A small maintenance android and one of her first friends. He mends things.",
      },
      {
        slug: "layla",
        name: "Layla",
        text: "They met in a ruined lane, where Angela tackled her away from a falling chimney and asked to be her friend.",
      },
      {
        slug: "lesley",
        name: "Lesley",
        text: "Pinned a badge on her for holding up a shield over a child, and told her she could call her Lesley.",
      },
    ],
  },
  laterInStory: [
    {
      text: "On graduation day Fanny teaches her to fly on a cable, without any wings at all.",
      chapterId: "c54",
    },
    {
      text: "She hears someone holding a gap in the Matrix open from the other side.",
      chapterId: "c54",
    },
  ],
  keyQuotes: [5, 6, 18, 23, 33, 40],
  inStory: {
    chapterIds: ["c35", "c37", "c38", "c39", "c40", "c42", "c43", "c44", "c46", "c54", "c60"],
  },
};
