/**
 * Selena's profile, written like a resume. Every line comes from the novel, the character bible or
 * her voice lines. Where the sources say nothing, the field is left out.
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
  { label: "Age", value: "19" },
  { label: "Birthday", value: "June 18" },
  { label: "MBTI", value: "ENTP" },
  { label: "Aspirant title", value: "Silverbolt Raiko" },
  { label: "Species", value: "A full {{enders|Ender}}, born in human form" },
  {
    label: "Occupation",
    value: "Science Division mechanic at {{selrick-academy|Selrick Academy}}",
  },
  {
    label: "Side job",
    value: "Secretly a spy for {{obsidia|Obsidia}}, and a seller of Ender parts",
  },
  { label: "Home", value: "Grew up in {{terrinia|Terrinia}}, above a bakery" },
  { label: "Weapon", value: "{{silverbolt|Silverbolt}}, a dragon of white-silver metal" },
];

export const SUMMARY =
  "Selena is the Academy's best young mechanic. She has red eyes, a lazy smile and a friend for everyone. She is also an Ender, made by Obsidia and raised by a rescue worker. She plays at being human, and slowly finds that it is not a game.";

export const SKILLS: readonly string[] = [
  "Mecha engineering",
  "Hearing Ender tissue hum",
  "Flying Silverbolt",
  "Catching lightning",
  "Improvising under pressure",
  "Copying a smile until it is real",
  "Teaching cadets",
  "Tracing a signal to its sender",
];

export const EXPERIENCE: readonly ExperienceEntry[] = [
  {
    role: "Mechanic, Science Division",
    place: "{{selrick-academy|Selrick Academy}}, third-floor lab",
    note: "Hired by {{change|Chang'e}} on her first visit. She wakes any machine with one tap of a spanner.",
  },
  {
    role: "Intern",
    place: "The {{shield-of-dawnbreak|Shield}}'s salvage yard",
    note: "Handled wrecked Ender plates during the years of ash. She felt one hum, and kept it.",
  },
  {
    role: "Builder and pilot of Silverbolt",
    place: "Selrick Academy",
    note: "Woke a mecha that eleven people could not move, and it became her dragon.",
  },
  {
    role: "Lecturer",
    place: "Cadet lectures at the Academy",
    note: "Taught the weak spot of an Ultra Ender. {{fanny|Fanny}} and {{layla|Layla}} both used it.",
  },
  {
    role: "Opener of the Oro casket",
    place: "The Science Division lab",
    note: "Hummed a locked memory crystal open and named the {{ender-control-core|Control Core}}.",
  },
  {
    role: "Dealer in Ender parts",
    place: "{{underhill|Underhill}}, the black market",
    note: "Sold pieces of wreckage. She lent {{vexana|Vexana}} a needle that could break the Core.",
  },
  {
    role: "Graduate",
    place: "Selrick Academy",
    note: "Her name was read on the lawn, and her scroll was handed to her by {{lesley|Lesley}}.",
  },
];

export const LIKES: readonly string[] = [
  "Honey-cake",
  "Red candy on a stick",
  "Storms and lightning",
  "Her picture book",
  "Mecha and Ender plates",
  "Life at the Academy",
  "Chaos, when it is a good stage",
  "A joke in a tight spot",
];

export const DISLIKES: readonly string[] = [
  "Being controlled",
  "Waking up early",
  "The blinding sun",
  "Taking orders",
  "Being called a champion of justice",
  "Being nobody's",
];

export const TIES: readonly Tie[] = [
  {
    name: "Karina Voss",
    relation: "Mum",
    entity: "karina-voss",
    text: "A rescue worker who found her in the rain at Hollin Reach and raised her above a bakery. Selena chose her.",
  },
  {
    name: "Obsidia",
    relation: "Creator",
    entity: "obsidia",
    text: "Made her, set her down in the rain, and has watched her ever since. Selena calls her Mother and refuses her.",
  },
  {
    name: "Chang'e",
    relation: "Chief",
    entity: "change",
    text: "Her chief in the lab. She has known what Selena is for a long time, and told her: I trust you.",
  },
  {
    name: "Lesley",
    relation: "Old friend",
    entity: "lesley",
    text: "They met as children by a lake and shared a honey-cake. Selena pulled up her blanket in a rescue wagon.",
  },
  {
    name: "Guinevere and Vexana",
    relation: "Friends",
    entity: "vexana",
    text: "She built their drones with them, taught Guinevere to listen to a crystal, and lent Vexana a needle.",
  },
  {
    name: "Silverbolt",
    relation: "Her baby",
    entity: "silverbolt",
    text: "The dragon she made from the bones of her own kind. It knows who its friend is.",
  },
];

export const PROJECTS: readonly Fact[] = [
  {
    label: "Silverbolt",
    value:
      "A white-silver dragon with blue gem eyes. It folds into two crescent blades that circle her like moons.",
  },
  {
    label: "The cat-ear drones",
    value: "Six weeks of circuits, black paint and metal ears with Guinevere and Vexana.",
  },
  {
    label: "The northern valve",
    value:
      "Ordered to wear the Defence Sphere thin, she turned the wheel the wrong way and made it run better.",
  },
  {
    label: "The Ultra lecture",
    value:
      "Every Ultra needs a second and a half to plant a foot. Hit the knee, then the neck seam.",
  },
  {
    label: "The needle",
    value: "A sliver of a Warden's heart, tuned to the Core. Lent to Vexana for a story in return.",
  },
  {
    label: "The leash",
    value: "A pull is a handle, and a handle works both ways. She worked this out herself.",
  },
];

/** The two voices on her profile: the normal form speaks line 1, the Ender form line 19. */
export const PROFILE_VOICES = [
  { form: "Normal form", n: 1 },
  { form: "Ender form", n: 19 },
] as const;
