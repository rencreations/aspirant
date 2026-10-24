import { skillIcon, type SkillIcon, type VideoName } from "../media";

/**
 * Vexana's kit, in Aspirant terms. The behaviour and the figures are the game's (the hero's page
 * on the Mobile Legends: Bang Bang wiki: the passive, the three skills and the recast of the last),
 * the names and the words are this story's. `game` keeps the name the game gives each skill, and
 * the clips are the game's own footage. None of it is part of the story.
 */
interface SkillRow {
  label: string;
  values: readonly string[];
}

interface Recast {
  name: string;
  icon: string;
  text: string;
  facts: ReadonlyArray<readonly [label: string, value: string]>;
}

export interface Skill {
  id: string;
  /** The key on the dock and the line above the name. */
  slot: string;
  name: string;
  /** What the game calls it. */
  game: string;
  tags: readonly string[];
  text: readonly string[];
  /** The few figures that decide how it feels, shown first. */
  facts: ReadonlyArray<readonly [label: string, value: string]>;
  /** What the columns of `rows` mean ("Skill level", "Hero level"). */
  columns: string;
  heads: readonly string[];
  rows: readonly SkillRow[];
  notes: readonly string[];
  /** The colour of the skill on the dock, the frame and the name. */
  tone: string;
  icon: string;
  clip: VideoName;
  /** The same key, pressed a second time. */
  recast?: Recast;
}

const icon = (n: SkillIcon) => skillIcon(n);

const SIX = ["1", "2", "3", "4", "5", "6"] as const;

export const SKILLS: readonly Skill[] = [
  {
    id: "passive",
    slot: "Passive",
    name: "Hum Mark",
    game: "Nether Touch",
    tags: ["Mark", "Burst"],
    text: [
      "Her staff leaves the Enders' own hum on whatever it strikes, and her Guardian does the same. A marked Ender rings for 5 seconds.",
      "If it falls while it rings, the hum bursts and hurts the Enders beside it.",
    ],
    facts: [
      ["Rings for", "5 s"],
      ["Bursts", "When it falls"],
      ["Cost", "None"],
    ],
    columns: "Her level",
    heads: ["1", "5", "9", "13", "15"],
    rows: [{ label: "Burst", values: ["108", "220", "332", "444", "500"] }],
    notes: [
      "The burst adds 60% of her Aspirant power.",
      "Each basic attack marks, and renews the mark of, the Enders it reaches.",
    ],
    tone: "#a98bf5",
    icon: icon("passive"),
    clip: "skill-passive",
  },
  {
    id: "skill-1",
    slot: "Skill 1",
    name: "Opposite Note",
    game: "Deathly Grasp",
    tags: ["Ranged", "Freeze"],
    text: [
      "She sings the note opposite to an Ender's hum. A ray of sound flies where she aims and hurts whatever it crosses.",
      "It stops at the first Ender it meets, pushes it back and freezes it. Then the note bursts, hurts the Enders close by and freezes them for 1 second.",
    ],
    facts: [
      ["Freeze", "1 s"],
      ["Wait", "14 to 11 s"],
      ["Cost", "80 to 130"],
    ],
    columns: "Skill level",
    heads: SIX,
    rows: [
      { label: "Ray", values: ["200", "220", "240", "260", "280", "300"] },
      { label: "Burst", values: ["200", "220", "240", "260", "280", "300"] },
      { label: "Wait (s)", values: ["14", "13.4", "12.9", "12.2", "11.6", "11"] },
      { label: "Cost", values: ["80", "90", "100", "110", "120", "130"] },
    ],
    notes: ["The ray and the burst each add 60% of her Aspirant power."],
    tone: "#7fe0ff",
    icon: icon("skill-1"),
    clip: "skill-1",
  },
  {
    id: "skill-2",
    slot: "Skill 2",
    name: "Folded Point",
    game: "Cursed Blast",
    tags: ["Zone", "Delayed"],
    text: [
      "She marks a patch of ground, and her orb lets a dark bead fall. For a breath, nothing happens.",
      "After 0.8 seconds the bead folds the whole patch into a single point and strikes every Ender inside it.",
    ],
    facts: [
      ["Delay", "0.8 s"],
      ["Wait", "7 to 5.5 s"],
      ["Cost", "80 to 130"],
    ],
    columns: "Skill level",
    heads: SIX,
    rows: [
      { label: "Strike", values: ["580", "634", "689", "743", "797", "850"] },
      { label: "Wait (s)", values: ["7", "6.7", "6.4", "6.1", "5.8", "5.5"] },
      { label: "Cost", values: ["80", "90", "100", "110", "120", "130"] },
    ],
    notes: ["The strike adds 165% of her Aspirant power."],
    tone: "#f26ec3",
    icon: icon("skill-2"),
    clip: "skill-2",
  },
  {
    id: "skill-3",
    slot: "Skill 3",
    name: "The Guardian Answers",
    game: "Eternal Guard",
    tags: ["Summon", "Recast"],
    text: [
      "She takes her Ender form, and a giant Guardian answers her call. It lands where she points, strikes every Ender there and throws it into the air for 0.8 seconds.",
      "Then it fights beside her for 15 seconds, and each of its blows hits a wide area.",
    ],
    facts: [
      ["Stays", "15 s"],
      ["Wait", "60 to 46 s"],
      ["Cost", "120 to 200"],
    ],
    columns: "Skill level",
    heads: ["1", "2", "3"],
    rows: [
      { label: "Landing", values: ["480", "600", "720"] },
      { label: "Each blow", values: ["200", "250", "300"] },
      { label: "Guardian health", values: ["+1800", "+2250", "+2700"] },
      { label: "Guardian defense", values: ["+40", "+50", "+60"] },
      { label: "Guardian Aspirant power", values: ["+80", "+100", "+120"] },
      { label: "Wait (s)", values: ["60", "53", "46"] },
      { label: "Cost", values: ["120", "160", "200"] },
    ],
    notes: [
      "The landing adds 60% of her Aspirant power. Each blow adds 40% of it, and 5% of the Ender's health.",
      "The Guardian shares all her strengths, except its health.",
      "It goes for the Enders near her first, then for the one she faces.",
      "She keeps one Guardian at a time. A new call sends the old one away.",
    ],
    tone: "#e8b949",
    icon: icon("skill-3"),
    clip: "skill-3",
    recast: {
      name: "Send Back",
      icon: icon("skill-3-cancel"),
      text: "Press the same key a second time and the Guardian goes home to her orb. It can be called again after the wait. If she falls, the way back is lost.",
      facts: [
        ["Press", "The same key"],
        ["Keeps", "One Guardian"],
        ["If she falls", "No recall"],
      ],
    },
  },
];
