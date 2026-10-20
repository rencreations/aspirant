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
];

export const SUMMARY =
  "Obsidia is the first Ender who ever woke up. The Will of the Planet made her its commander, and she rules the Enders from the Storm Citadel. She is cold, calm and very clever. She is also bored, curious about the people she is sent to break, and she hopes for an ending she cannot predict.";

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

/** The voices on her profile: her mission, her storm, and the line that is nearest to feeling. */
export const PROFILE_VOICES = [
  { form: "Her mission", n: 1 },
  { form: "Her storm", n: 30 },
  { form: "Her quiet", n: 41 },
] as const;
