import type { CharacterData } from "../types";

export const lesley: CharacterData = {
  slug: "lesley",
  order: 5,
  name: "Lesley",
  aspirantName: "Deadeye Spectre",
  jp: { script: "ラズリー", romaji: "Razurī" },
  ageText: "20",
  birthday: "September 10",
  mbti: "ISTJ",
  role: "Sniper and head of the Academy's combat division",
  weapon: "A red-orange sniper rifle that talks to her artificial eye, and a knife of cyan light",
  partnerSlug: "change",
  pair: "lesley-change",
  side: "daybreak",
  palette: { primary: "#E4512B", secondary: "#F2C35B", glow: "#39D3E3", ink: "#1C0F0D" },
  tagline: "She stays. That is what a Big Sis does.",
  summary:
    "Lesley lost her family and her left eye in the first catastrophe, in 978. She became the best shot in the Shield, then the guard of a small scientist called Chang'e. Together they founded Selrick Academy, where Lesley leads combat training.",
  sections: {
    personality: [
      "Quiet, steady and reserved. She does not open her heart easily.",
      "Dutiful and exact: she writes the hour in the log, follows procedure and keeps her promises.",
      "Protective to the bone, often from a distance.",
      "Carries guilt for the times she was not there.",
      "Her rare smiles mean a great deal to the people who see them.",
    ],
    appearance: [
      "Golden blonde hair in a high ponytail with a red streak, fading to red at the ends.",
      "One blue eye. Her left eye is the one Chang'e built, under a dark cover with a small cyan star.",
      "A white officer's coat with red and gold trim, a red sash belt, and red and black boots.",
    ],
    fighting: [
      "A sniper. As a cadet she learned to judge distance with one eye by moving her head.",
      "Her rifle and her eye work together: the eye measures, the scope adjusts, and she can simply look.",
      "A cloak that bends the light hides her. She calls it stealth mode.",
      "Her shot can ride a thread of blue light through one Ender after another. The word that came to her for it was Pulsar.",
    ],
    background: [
      "She grew up in Valemont with her father Tomas, her mother Marta and her little brother Pim.",
      "On the night of the ninth of September, 978, an Ender broke into their cellar. She lost her family and her left eye, and woke in the rubble on her ninth birthday.",
      "Sergeant Brandt trained her at the Cadet Corps. He called her Deadeye as a rough joke, and she kept it.",
      "Posted to guard Selrick Base, she met Chang'e and her parents, and found a second family.",
      "On her birthday Chang'e gave her an eye and a rifle. Lesley told her what a Big Sis does: she stays.",
    ],
    motivation: [
      "To protect Chang'e, always.",
      "That no more families should suffer as hers did.",
      "To teach a loving heart, perseverance and aspirant power, not only technique.",
    ],
    flaws: [
      "Guilt and self-blame: why wasn't I there?",
      "Keeps her feelings behind a wall.",
      "Was once driven by hatred of the Enders.",
      "Protects in secret rather than saying what she feels.",
    ],
    relationships: [
      {
        slug: "change",
        name: "Chang'e",
        text: "Her little sister in all but blood, her partner and her co-founder. Chang'e calls her Big Sis.",
      },
      {
        slug: null,
        entityId: "brandt",
        name: "Sergeant Brandt",
        text: "Her old trainer at the Cadet Corps. He taught a one-eyed girl to shoot, and told her it would take years.",
      },
      {
        slug: null,
        entityId: "karina-voss",
        name: "Karina Voss",
        text: "Found her in the ruins of Valemont, and kept coming back to sit with her, asking nothing.",
      },
      {
        slug: "ruby",
        name: "Ruby",
        text: "Met her inside Oro's Institute. Ruby did not raise the alarm, and Lesley spoke for her at the hearing.",
      },
      {
        slug: "selena",
        name: "Selena",
        text: "As a child, Lesley shared her honey-cake with a small red-eyed girl, who later sat by her in the rescue wagon. Lesley did not remember the red eyes for many years.",
      },
    ],
  },
  laterInStory: [
    {
      text: "She goes alone through the Aperture to Oro and cuts the Spine, with Chang'e in her ear.",
      chapterId: "c29",
    },
    {
      text: "On graduation day she shoots the Guardian's golden halo from a roof, about the ninth hardest shot she has ever taken.",
      chapterId: "c56",
    },
  ],
  keyQuotes: [3, 4, 11, 16, 20, 36],
  inStory: {
    chapterIds: [
      "c11",
      "c12",
      "c14",
      "c16",
      "c17",
      "c18",
      "c19",
      "c20",
      "c21",
      "c22",
      "c28",
      "c29",
      "c44",
      "c56",
      "c60",
    ],
  },
};
