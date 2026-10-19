import type { SKILL_CLIPS } from "./clips.generated";

/**
 * Selena's game skills, from the Mobile Legends: Bang Bang wiki (hero page for Selena). These are
 * game rules, not story. The wording is ours, the numbers are the wiki's. The skill icons are in
 * `public/img/selena/skills/` and the clips in `public/video/selena/skills/`.
 *
 * Markup in text: `{{entity-id|words}}` makes the words a tooltip for a glossary entry.
 */
export type ClipId = keyof typeof SKILL_CLIPS;
export type FormId = "elven" | "abyssal";

interface ScalingRow {
  label: string;
  /** One value per skill level. */
  values: readonly string[];
}

export interface Skill {
  id: string;
  /** The slot: Passive, Skill 1, Skill 2 or Ultimate. */
  slot: string;
  name: string;
  /** Which form this skill belongs to. The passive belongs to both. */
  form: FormId | "both";
  icon: string;
  tags: readonly string[];
  text: readonly string[];
  scaling: readonly ScalingRow[];
  notes: readonly string[];
  /** The clip that shows it. */
  clip: ClipId;
  /** Said under the clip when the skill has no clip of its own. */
  clipNote?: string;
}

const L6 = ["Lv 1", "Lv 2", "Lv 3", "Lv 4", "Lv 5", "Lv 6"] as const;
export const LEVEL_HEAD: Record<"six" | "four", readonly string[]> = {
  six: L6,
  four: L6.slice(0, 4),
};

export const SKILLS: readonly Skill[] = [
  {
    id: "symbiosis",
    slot: "Passive",
    name: "Symbiosis",
    form: "both",
    icon: "passive",
    tags: ["Buff"],
    text: [
      "Selena can switch freely between her two forms.",
      "In Elven Form her skills put an Abyssal Mark on enemies. It stacks up to 2 times. When an Abyssal Trap hits, it adds a mark at once.",
      "In Abyssal Form every hit uses up 1 mark and deals extra magic damage: 225, plus 15 for each hero level, plus 40% of her total Magic Power. Marks deal 285% extra damage to units that are not heroes.",
    ],
    scaling: [],
    notes: [],
    clip: "skin-intro",
    clipNote:
      "A passive has nothing to cast, so this is the opening of her skin, where she changes form.",
  },
  {
    id: "abyssal-trap",
    slot: "Skill 1",
    name: "Abyssal Trap",
    form: "elven",
    icon: "skill-1",
    tags: ["Summon", "Slow"],
    text: [
      "Selena summons an Abyssal Devil at a spot of her choice. It clings to any enemy that comes near and slows them by 50%.",
      "After 3 seconds it deals 350 to 550 magic damage (plus 150% of her Magic Power) to that enemy and the ones around it, and slows them by 50% for 1 more second.",
      "A devil lasts up to 60 seconds. Up to 3 can exist at once, and each extra devil adds 50% to the final damage.",
    ],
    scaling: [
      { label: "Cooldown (s)", values: ["8.0", "7.6", "7.2", "6.8", "6.4", "6.0"] },
      { label: "Mana", values: ["60", "70", "80", "90", "100", "110"] },
      { label: "Base damage", values: ["350", "390", "430", "470", "510", "550"] },
    ],
    notes: [
      "The devils give vision of the area around them.",
      "The damage bonus from extra devils is at most 150%.",
    ],
    clip: "trap",
  },
  {
    id: "soul-eater",
    slot: "Skill 1",
    name: "Soul Eater",
    form: "abyssal",
    icon: "skill-1-abyssal",
    tags: ["Burst", "Shield"],
    text: [
      "Selena strengthens her claws with the power of the Abyss. Her next basic attack deals 200 to 350 extra magic damage (plus 130% of her Magic Power).",
      "It also gives her a shield that absorbs 300 to 400 damage (plus 150% of her Magic Power).",
    ],
    scaling: [
      { label: "Cooldown (s)", values: ["6.0", "5.5", "5.0", "4.5", "4.0", "3.5"] },
      { label: "Mana", values: ["60", "65", "70", "75", "80", "85"] },
      { label: "Base damage", values: ["200", "230", "260", "290", "320", "350"] },
      { label: "Shield", values: ["300", "320", "340", "360", "380", "400"] },
    ],
    notes: ["The boosted basic attack can crit."],
    clip: "soul-eater",
  },
  {
    id: "abyssal-arrow",
    slot: "Skill 2",
    name: "Abyssal Arrow",
    form: "elven",
    icon: "skill-2",
    tags: ["Crowd control", "Speed up"],
    text: [
      "Selena fires magic arrows in a line. The first enemy hero they hit takes 250 to 400 damage (plus 20% of her Magic Power) and is stunned for 0.5 seconds.",
      "The farther the arrows fly, the more they hurt and the longer they stun: up to 500 to 800 damage (plus 40% of her Magic Power) and 2.5 seconds.",
      "The arrows pick up Abyssal Traps on the way, so the target gets their effects. If the stun lasts 0.9 seconds or more, Selena gains 40% movement speed for 2 seconds.",
    ],
    scaling: [
      { label: "Cooldown (s)", values: ["12.0", "12.0", "12.0", "12.0", "12.0", "12.0"] },
      { label: "Mana", values: ["70", "80", "90", "100", "110", "120"] },
      { label: "Base damage", values: ["250", "280", "310", "340", "370", "400"] },
      { label: "Max damage", values: ["500", "560", "620", "680", "740", "800"] },
    ],
    notes: ["It is one of the longest stuns in the game."],
    clip: "arrow",
  },
  {
    id: "garotte",
    slot: "Skill 2",
    name: "Garotte",
    form: "abyssal",
    icon: "skill-2-abyssal",
    tags: ["Mobility", "Buff"],
    text: [
      "Selena charges in a direction she picks and deals 150 to 350 magic damage (plus 50% of her Magic Power) to the enemies on the way.",
      "If that damage uses up an Abyssal Mark, the skill's cooldown resets at once.",
    ],
    scaling: [
      { label: "Cooldown (s)", values: ["12.0", "11.4", "10.8", "10.2", "9.6", "9.0"] },
      { label: "Mana", values: ["70", "80", "90", "100", "110", "120"] },
      { label: "Base damage", values: ["150", "190", "230", "270", "310", "350"] },
    ],
    notes: ["It is a magic skill, but it gives spell vamp and not magic lifesteal."],
    clip: "garotte",
  },
  {
    id: "primal-darkness",
    slot: "Ultimate",
    name: "Primal Darkness",
    form: "elven",
    icon: "skill-3",
    tags: ["Morph", "Speed up"],
    text: [
      "Selena enters Abyssal Form and gains 30% movement speed for 0.8 seconds. Soul Eater and Garotte reset at once.",
      "In Abyssal Form she gains new skills, and her basic attacks deal 25% of her Magic Power as extra magic damage.",
      "Passive: she gains 5 to 20 Magic Power.",
    ],
    scaling: [
      { label: "Cooldown (s)", values: ["5.5", "5.5", "5.5", "5.5"] },
      { label: "Speed bonus", values: ["30%", "40%", "50%", "60%"] },
      { label: "Magic Power", values: ["5", "10", "15", "20"] },
    ],
    notes: [
      "The extra basic attack damage applies to one target. Other targets take her normal physical damage.",
    ],
    clip: "primal-darkness",
  },
  {
    id: "moon-goddess",
    slot: "Ultimate",
    name: "Blessing of the Moon Goddess",
    form: "abyssal",
    icon: "skill-3-abyssal",
    tags: ["Morph", "Speed up"],
    text: [
      "Selena enters Elven Form and gains 30% movement speed for 0.8 seconds. Abyssal Trap and Abyssal Arrow reset at once.",
      "Passive: she gains 5 to 20 Magic Power.",
    ],
    scaling: [
      { label: "Cooldown (s)", values: ["5.5", "5.5", "5.5", "5.5"] },
      { label: "Speed bonus", values: ["30%", "40%", "50%", "60%"] },
      { label: "Magic Power", values: ["5", "10", "15", "20"] },
    ],
    notes: [],
    clip: "moon-goddess",
  },
];

export interface Stat {
  label: string;
  value: string;
}

export const OVERVIEW: readonly Stat[] = [
  { label: "Role", value: "Assassin and Mage" },
  { label: "Specialty", value: "Initiator and Finisher" },
  { label: "Lane", value: "Mid lane and roaming" },
  { label: "Resource", value: "Mana" },
  { label: "Damage", value: "Magic" },
  { label: "Basic attack", value: "Hybrid" },
];

export const RATINGS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "Durability", value: 4 },
  { label: "Offense", value: 7 },
  { label: "Control effects", value: 10 },
  { label: "Difficulty", value: 8 },
];

export interface Extra {
  clip: ClipId;
  title: string;
  note: string;
}

/** The parts of the skin showcase that are not a skill. */
export const EXTRAS: readonly Extra[] = [
  {
    clip: "skin-intro",
    title: "Skin opening",
    note: "Selena changes form in the Silverbolt Raiko skin.",
  },
  {
    clip: "skin-flight",
    title: "Silverbolt in flight",
    note: "The skin's flying scene, with Silverbolt beside her.",
  },
  { clip: "idle", title: "Idle animation", note: "How she waits on the hero screen." },
  {
    clip: "interactive",
    title: "Interactive animation",
    note: "What she does when you touch the screen.",
  },
];

export const HOW_IT_FLOWS: readonly string[] = [
  "Primal Darkness takes her to Abyssal Form and resets Soul Eater and Garotte.",
  "Blessing of the Moon Goddess takes her back to Elven Form and resets Abyssal Trap and Abyssal Arrow.",
  "Garotte resets itself when it uses an Abyssal Mark, so a marked target lets her dash again.",
];

export const CLIP_LABEL: Record<ClipId, string> = {
  trap: "Abyssal Trap",
  "soul-eater": "Soul Eater",
  arrow: "Abyssal Arrow",
  garotte: "Garotte",
  "primal-darkness": "Primal Darkness",
  "moon-goddess": "Blessing of the Moon Goddess",
  "skin-intro": "Skin opening",
  "skin-flight": "Silverbolt in flight",
  idle: "Idle animation",
  interactive: "Interactive animation",
};
