import { skillIcon, type SkillIcon } from "../media";

/**
 * Vexana's kit in Aspirant terms: a passive, three skills, and the recast of the third. The kinds
 * follow the reference kit (a mark that bursts, a ray that stops at the first target, a delayed
 * zone, a summon with a recast). Every name and line is written for this story. The figures are
 * this page's own, plain numbers for show.
 */
export type DemoKind = "passive" | "note" | "point" | "guardian" | "recall";

export interface Skill {
  id: SkillIcon;
  demo: DemoKind;
  /** The kind of skill, set small above the name. */
  kind: string;
  name: string;
  text: string;
  stats: ReadonlyArray<readonly [label: string, value: string]>;
  /** The colour of this skill in the dial and the demonstration. */
  tone: string;
  icon: string;
}

const make = (s: Omit<Skill, "icon">): Skill => ({ ...s, icon: skillIcon(s.id) });

const FALLBACK: Skill = make({
  id: "passive",
  demo: "passive",
  kind: "Passive",
  name: "Hum Mark",
  text: "",
  stats: [],
  tone: "#a98bf5",
});

export const SKILLS: readonly Skill[] = [
  make({
    id: "passive",
    demo: "passive",
    kind: "Passive",
    name: "Hum Mark",
    text: "Her staff, and later her Guardian, leave the Enders' own hum on whatever they strike. A marked Ender rings for five seconds. If it falls while it rings, the hum bursts and hurts the Enders beside it.",
    stats: [
      ["Lasts", "5 s"],
      ["Spreads", "When it falls"],
      ["Cost", "None"],
    ],
    tone: "#a98bf5",
  }),
  make({
    id: "skill-1",
    demo: "note",
    kind: "Skill one, ranged",
    name: "Opposite Note",
    text: "She sings the note opposite to an Ender's hum. A ray of sound flies out and stops at the first Ender it meets, which freezes for a moment and is pushed back. Then the note bursts, and every Ender close to it freezes for about a second.",
    stats: [
      ["Reach", "Long, straight"],
      ["Freeze", "About 1 s"],
      ["Wait", "12 s"],
    ],
    tone: "#7fe0ff",
  }),
  make({
    id: "skill-2",
    demo: "point",
    kind: "Skill two, zone",
    name: "Folded Point",
    text: "She marks a patch of ground, and her orb lets a dark bead fall. For a breath, nothing happens. Then the bead folds the whole patch into a single point and strikes every Ender inside it.",
    stats: [
      ["Delay", "0.8 s"],
      ["Area", "Round, wide"],
      ["Wait", "6 s"],
    ],
    tone: "#f26ec3",
  }),
  make({
    id: "skill-3",
    demo: "guardian",
    kind: "Skill three, summon",
    name: "The Guardian Answers",
    text: "She takes her Ender form, and a giant Guardian answers her call. It lands where she points, throws the Enders in its way into the air, then fights beside her with wide, heavy blows.",
    stats: [
      ["Lands", "Where she points"],
      ["Stays", "15 s"],
      ["Wait", "50 s"],
    ],
    tone: "#e8b949",
  }),
  make({
    id: "skill-3-cancel",
    demo: "recall",
    kind: "Skill three, recast",
    name: "Send Back",
    text: "Press the call a second time and the Guardian goes home to her orb at once. It can be called again after the wait. She keeps one Guardian at a time.",
    stats: [
      ["Press", "Same button"],
      ["Takes", "Instant"],
      ["Keeps", "One Guardian"],
    ],
    tone: "#b9a8e8",
  }),
];

/** The skill at an index, or the passive for anything out of range. */
export function skillAt(i: number): Skill {
  return SKILLS[i] ?? FALLBACK;
}
