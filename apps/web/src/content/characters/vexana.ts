import type { CharacterData } from "../types";

export const vexana: CharacterData = {
  slug: "vexana",
  order: 8,
  name: "Vexana",
  aspirantName: "Twilight Star",
  jp: { script: "サナ", romaji: "Sana" },
  ageText: "17",
  birthday: "March 10",
  mbti: "INFJ",
  role: "Staff mage and Ender-form summoner",
  weapon:
    "A staff with a crescent head and a black orb. In her Ender form, a giant Guardian answers her call.",
  partnerSlug: "guinevere",
  pair: "guinevere-vexana",
  side: "daybreak",
  palette: { primary: "#7A4FD6", secondary: "#E040A0", glow: "#D9D5F5", ink: "#140E26" },
  tagline: "The dark that makes the sun visible.",
  summary:
    "Vexana is a quiet girl who can hear the Enders hum. After her father died shielding her, she promised never to love anyone again, and hid in a broom cupboard. Then Guinevere found her, with a doughnut.",
  sections: {
    personality: [
      "Quiet, shy and watchful. She reads people well.",
      "Carries a deep, private guilt.",
      "Bookish. She keeps a book of poems and a lamp with a green shade.",
      "Would give up everything for the people she loves, and say nothing about it.",
      "Laughs rarely, and when she does, it surprises her.",
    ],
    appearance: [
      "Very long dark hair with a violet sheen, and one stubborn lock that stands up.",
      "Violet eyes.",
      "White gloves, even in summer, with the Academy uniform and a purple tie.",
      "The Emblem of Hope, a small gold star, pinned at her collar.",
    ],
    fighting: [
      "A staff mage at range. Her staff has a crescent at its head and a black orb inside the crescent.",
      "She can freeze an Ender for about a second by singing the opposite note to its hum.",
      "Her orb can drop a small dark bead that folds Enders into a point.",
      "She stands twelve paces behind Guinevere and watches her back.",
    ],
    background: [
      "Her father was a soldier of the Shield who guarded the north gate of the old quarter. He called her Sana.",
      "On the evening Selrick Base fell, she went back for a handful of spilled plums, and her father died shielding her.",
      "Chang'e measured her aspirant power as the deepest she had ever seen: dark, like a well.",
      "She told Guinevere she was strong, and ran. Later she turned her down as a partner, and then said yes.",
      "The registry clerk once saw a girl reading poetry in the last light of the day, and gave Vexana the designation Twilight Star.",
    ],
    motivation: [
      "To protect Guinevere, at any cost to herself.",
      "To make up for her father's death, which she believes was her fault.",
      "Never again to be the reason that somebody dies.",
    ],
    flaws: [
      "Hides from people out of habit.",
      "Guilt, and a belief that the worst is fated.",
      "Keeps her plans secret, even from the people she trusts.",
      "Too willing to give herself up.",
    ],
    relationships: [
      {
        slug: "guinevere",
        name: "Guinevere",
        text: "Her partner and best friend, who brought colour to her world. Vexana's Emblem says one thing if she is ever lost: I'm here.",
      },
      {
        slug: null,
        name: "Her father",
        text: "A big, quiet soldier of the Shield who called her Sana, shared plums with her and told her to be brave.",
      },
      {
        slug: "change",
        name: "Chang'e",
        text: "Let her into the Academy and asked one thing of her: find someone who can hold the other end.",
      },
      {
        slug: "selena",
        name: "Selena",
        text: "Worked with her on Guinevere's old drones. Selena did the circuits, and Vexana did the sums.",
      },
    ],
  },
  laterInStory: [
    {
      text: "She is taken through a black gate in the corridor, after pushing Guinevere out of the way.",
      chapterId: "c47",
    },
    {
      text: "In the void, the Will remakes her as an Ender. She keeps the Emblem at her throat.",
      chapterId: "c48",
    },
    {
      text: "Selena lends her a needle at Underhill, in return for a story when it is over.",
      chapterId: "c50",
    },
  ],
  forms: {
    normal:
      "Long dark hair with a violet sheen, violet eyes, white gloves, and the Academy uniform with a purple tie.",
    ender:
      "Hair silver-lavender fading to magenta, small gold-edged horns, glowing pink eyes, a black halter bodice and a long purple cape.",
  },
  keyQuotes: [1, 13, 14, 17, 21, 33],
  inStory: {
    chapterIds: [
      "c05",
      "c06",
      "c07",
      "c08",
      "c09",
      "c10",
      "c41",
      "c45",
      "c47",
      "c48",
      "c50",
      "c53",
      "c55",
      "c56",
      "c57",
      "c60",
    ],
  },
};
