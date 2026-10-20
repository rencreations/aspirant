/**
 * Obsidia's profile, written like a resume. Every line comes from the novel, the character bible
 * or her voice lines. Where the sources say nothing, the field says so or is left out.
 *
 * Markup in text: `{{entity-id|words}}` makes the words a tooltip for a glossary entry.
 */
export interface Fact {
  label: string;
  value: string;
}

export interface ExperienceEntry {
  role: string;
  place: string;
  note: string;
}

export interface Tie {
  name: string;
  relation: string;
  text: string;
  /** Glossary id for the name, when there is one. */
  entity?: string;
}

export const PROFILE_FACTS: readonly Fact[] = [
  { label: "Age", value: "No human age. She is an Ender, awake for ages" },
  { label: "Birthday", value: "November 13" },
  { label: "MBTI", value: "INTJ" },
  { label: "Aspirant title", value: "Imperatrix Arashi" },
  { label: "Species", value: "An {{enders|Ender}}, the first one that ever woke" },
  {
    label: "Occupation",
    value:
      "{{imperatrix|Imperatrix}}: field commander of the Enders for the {{will-of-the-planet|Will of the Planet}}",
  },
  {
    label: "Home",
    value:
      "The {{storm-citadel|Storm Citadel}}, high above {{terrinia|Terrinia}}, with a garden at the top",
  },
  {
    label: "Weapon",
    value:
      "A beast's head at the end of a long chain of black plates, and command of storm and lightning",
  },
  {
    label: "Eyes",
    value: "Two that do not match: violet-blue with a star, pink-red with a diamond",
  },
  { label: "Voice", value: "41 lines, in Japanese, each with its English translation" },
];

export const SUMMARY =
  "Obsidia is the first Ender who ever woke up. The Will of the Planet made her its commander, and she rules the Enders from the Storm Citadel. She is cold, calm and very clever. She is also bored, curious about the people she is sent to break, and she hopes for an ending she cannot predict.";

export const SKILLS: readonly string[] = [
  "Strategy many moves ahead",
  "Commanding storm and lightning",
  "Directing the Ender fleets",
  "Watching a world through a long-sight",
  "Growing a body from her own cells",
  "Growing humanoid Enders",
  "Playing a board game alone, both sides",
  "Thinking a little to the side of what she says",
];

export const EXPERIENCE: readonly ExperienceEntry[] = [
  {
    role: "First Ender to wake",
    place: "Ages ago, far from {{dawnbreak|Dawnbreak}}",
    note: "An order from the {{mother-matrix|Matrix}} passed through her and did not take hold. She learned to stand still and watch.",
  },
  {
    role: "Imperatrix of the fleets",
    place: "The {{storm-citadel|Storm Citadel}}",
    note: "Chosen by the Will because she could see and the others could not. She commands for ages, and commands well.",
  },
  {
    role: "Keeper of the Chamber of Likenesses",
    place: "Inside the Citadel",
    note: "Grew humanoid Enders in vats. Most died. One opened her eyes and was kept for almost a year.",
  },
  {
    role: "Designer of the experiment in the rain",
    place: "{{hollin-reach|Hollin Reach}}",
    note: "Set a child down in a storm to learn what an Ender becomes when humans raise her.",
  },
  {
    role: "Caller of the recalibrations",
    place: "Dawnbreak and {{oro|Oro}}",
    note: "Called the Enders back when the work was done, and spared what she could: an old quarter, schools, libraries, hidden embers.",
  },
  {
    role: "Teacher of a board game",
    place: "The garden at the top of the Citadel",
    note: "Taught {{vexana|Vexana}} the one rule she likes: a pawn that crosses the whole board becomes a queen.",
  },
  {
    role: "Leader of the final purge",
    place: "{{terrinia|Terrinia}}",
    note: "Obeyed the order to the letter, and left one flaw in the plan, no wider than a hair.",
  },
];

export const LIKES: readonly string[] = [
  "Windows, and why people build them",
  "Her crooked tree in the garden",
  "The board game, played alone",
  "A pawn that crosses the board",
  "Questions with no answer",
  "Storm and lightning",
  "Doughnuts, as weapons",
  "A surprise she did not predict",
];

export const DISLIKES: readonly string[] = [
  "Boredom",
  "The quiet after a purge",
  "Walking, which makes her feel small",
  "Obeying out of habit",
  "All the answers she has mapped for Selena",
];

export const TIES: readonly Tie[] = [
  {
    name: "Selena",
    relation: "Her child",
    entity: "selena",
    text: "Obsidia made her, kept her for almost a year, and set her down in the rain. She called her a weapon, then understood she was jealous.",
  },
  {
    name: "The Will of the Planet",
    relation: "The mind she serves",
    entity: "will-of-the-planet",
    text: "It noticed her because she asked. She has obeyed it all her life, out of long habit.",
  },
  {
    name: "The Mother Matrix",
    relation: "Where she came from",
    entity: "mother-matrix",
    text: "The great body that made the Enders. It could not answer her first question.",
  },
  {
    name: "Karina Voss",
    relation: "The arms in the rain",
    entity: "karina-voss",
    text: "The rescue worker who opened her arms to the child. Obsidia saw in her the figure at the window of a falling tower.",
  },
  {
    name: "Vexana",
    relation: "A girl in her garden",
    entity: "vexana",
    text: "Came to the Citadel a liar. Obsidia saw it, did not tell, and taught her to think a little to the side of what she means.",
  },
  {
    name: "The Enders",
    relation: "Her fleets",
    entity: "enders",
    text: "A hundred thousand sleep in the Hall of the Sleepers. She commands them. She is not one of the flock.",
  },
];

export const PROJECTS: readonly Fact[] = [
  {
    label: "Her body",
    value:
      "Years of singing to her own cells until they listened: pale skin, a calm face, hair that fades from pink to rose to gold.",
  },
  {
    label: "The Chamber of Likenesses",
    value:
      "{{chamber-of-likenesses|Vats}} where humanoid Enders grow. Most died. She asked why they were made so much in the likeness of those they destroy.",
  },
  {
    label: "The seed",
    value:
      "One child with ruby eyes, a hidden recall thread in her blood, and a place in the rain at Hollin Reach.",
  },
  {
    label: "The long-sight",
    value: "An eye opened inside a small storm, that sees across a whole world.",
  },
  {
    label: "The board",
    value:
      "A game of war with one white pawn set a little ahead of the others. She plays both sides and often loses to herself.",
  },
  {
    label: "The flaw",
    value:
      "A crack in the Matrix's plan, no wider than a hair. She did not say where. It is the only gift she had left.",
  },
];

/** The voices on her profile: her mission, her storm, and the line that is nearest to feeling. */
export const PROFILE_VOICES = [
  { form: "Her mission", n: 1 },
  { form: "Her storm", n: 30 },
  { form: "Her quiet", n: 41 },
] as const;
