import type { CharacterData } from "../types";

export const layla: CharacterData = {
  slug: "layla",
  order: 2,
  name: "Layla",
  aspirantName: "Miss Hikari",
  jp: { script: "ライラ", romaji: "Raira" },
  ageText: "16",
  birthday: "November 29",
  mbti: "ENTJ",
  role: "Long-range cannon marksman",
  weapon: "A white laser cannon exactly as tall as she is. She calls it her magic gun.",
  partnerSlug: "fanny",
  pair: "fanny-layla",
  side: "daybreak",
  palette: { primary: "#FF7F7A", secondary: "#14B3A6", glow: "#7DF7EC", ink: "#14222B" },
  tagline: "She brought the light in with her.",
  summary:
    "Layla is the small, proud top student of Selrick Academy, with a cannon as tall as she is and a secret base high on a tower. She comes from Tanner's Row, though she tells no one. When Fanny takes first place, Layla makes her a rival, and then a partner.",
  sections: {
    personality: [
      "Proud, loud and quick to anger, with a soft heart she keeps out of sight.",
      "Competitive about everything, from the weekly ranking to a race with mops.",
      "A natural commander in a fight. She plans, gives orders and calls the gaps.",
      "Says she prefers to be alone.",
      "Hard to thank and slow to apologise, but she does both in the end.",
    ],
    appearance: [
      "Coral pink hair in two long ponytails that almost touch the floor.",
      "Sharp teal eyes, and a small fang when she grins.",
      "A customised black uniform coat with gold buttons, a teal tie and a small silver heart where the badge should be.",
      "Tall white mecha boots, and one white mecha glove with the other plain black.",
    ],
    fighting: [
      "Long range with her cannon: heavy, precise shots.",
      "The Armoury built the cannon, but she finished it herself, setting tiny chips with tweezers in a hidden workshop.",
      "With Fanny, she fires along Fanny's charged cable, and the beam bends with the line.",
      "She covers her partner while Fanny goes for the weak spot.",
    ],
    background: [
      "She grew up in Tanner's Row, where her mother keeps a market stall of cloth and thread and made her clothes by hand.",
      "She passed the Resonance Trial as number 38 of three hundred, with a beam that could be seen from the harbour.",
      "The clerk wrote her designation as Miss Hikari, which means Miss Light.",
      "She found the gantry in her first week and made it her secret base.",
      "Fanny's arrival ended her run at first place, and the Academy called what followed the frenemy business.",
    ],
    motivation: [
      "To be first, and to be seen.",
      "To protect the thousand lit windows of Tanner's Row, which she found she would die for.",
      "Under it all, to come home alive, as her mother asked.",
    ],
    flaws: [
      "Pride and jealousy, above all toward Fanny.",
      "Charges in without looking, and hates being told.",
      "Hides her fear behind bravado.",
      "Finds it hard to accept help or kindness.",
    ],
    relationships: [
      {
        slug: "fanny",
        name: "Fanny",
        text: "Her rival, then her partner. Fanny is the first person who ever stood behind her in a fight.",
      },
      {
        slug: null,
        name: "Her mother",
        text: "Keeps a stall on Tanner's Row and made Layla's clothes by hand. Her one request: come home alive.",
      },
      {
        slug: "guinevere",
        name: "Guinevere",
        text: "A rival since an eleven-second fight in the training hall that left a feather on Layla's chin.",
      },
      {
        slug: "angela",
        name: "Angela",
        text: "They met when Layla shouted a warning about a falling chimney and Angela tackled her to keep her safe. Layla admitted she was not so bad.",
      },
      {
        slug: "change",
        name: "Chang'e",
        text: "Gave her the Resonance Trial, and recommended her pairing with Fanny on the numbers alone.",
      },
      {
        slug: null,
        entityId: "pia",
        name: "Pia",
        text: "Her roommate, who in time is allowed onto the gantry.",
      },
    ],
  },
  laterInStory: [
    {
      text: "On graduation day she commands the square in the northern ward from a broken fountain.",
      chapterId: "c54",
    },
    {
      text: "At dawn her mother climbs all the way up from Tanner's Row to find her.",
      chapterId: "c60",
    },
  ],
  keyQuotes: [2, 8, 17, 18, 23],
  inStory: {
    chapterIds: [
      "c01",
      "c02",
      "c03",
      "c30",
      "c31",
      "c32",
      "c40",
      "c42",
      "c43",
      "c46",
      "c54",
      "c60",
    ],
  },
};
