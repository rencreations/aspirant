import { skillIcon, type SkillIcon, type VideoName } from "../media";

/**
 * Guinevere's skills exactly as the Mobile Legends: Bang Bang wiki lists them
 * (https://mobile-legends.fandom.com/wiki/Guinevere, the Abilities section): the official names,
 * the official descriptions, the effect tags, the skill terms, the level tables and the notes.
 * Nothing here is written for the story. The wiki's "to" ranges use a plain "to" instead of a dash,
 * and the square brackets the wiki puts around a scaled figure are left out. The clips are the
 * game's own footage.
 */
interface SkillRow {
  label: string;
  values: readonly string[];
}

export interface Skill {
  id: string;
  /** The line above the name and on the key: the wiki's own heading. */
  slot: string;
  /** The official name. */
  name: string;
  /** The effect tags the wiki shows under the name. */
  tags: readonly string[];
  /** The wiki line next to the tags, when it has one. */
  ratio?: string;
  /** The official description. */
  description: string;
  /** The wiki's "Skill terms": a name and, when the wiki gives one, what it says. */
  terms: ReadonlyArray<{ name: string; text?: string }>;
  /** The wiki's title of the level table (empty when the skill has no table). */
  scaling: string;
  /** The first cell of the table header ("Properties"). */
  propertyHead: string;
  heads: readonly string[];
  rows: readonly SkillRow[];
  /** The wiki's notes, in its order. */
  notes: readonly string[];
  /** The colour of the skill on the dock, the frame and the name. */
  tone: string;
  icon: string;
  /** The same key, when its icon changes (the second skill shows a second icon for its recast). */
  icon2?: string;
  clip: VideoName;
}

const icon = (n: SkillIcon) => skillIcon(n);

const SIX = ["1", "2", "3", "4", "5", "6"] as const;

const MAGIC_SKILL = {
  name: "Magic Skill",
  text: "Deal Magic DMG to enemies. Triggers Spell Vamp.",
} as const;

const AIRBORNE = {
  name: "Airborne",
  text: "High level Crowd Control: Prevents a target from moving, and using Basic Attacks and skills. Can interrupt a large number of skills, and Blink/Charge effects.",
} as const;

export const SKILLS: readonly Skill[] = [
  {
    id: "passive",
    slot: "Passive",
    name: "Super Magic",
    tags: ["Buff", "Damage"],
    description:
      "Guinevere deals 25% extra damage to airborne enemies and deals (+80% Total Physical Attack) (+60% Total Magic Power) Magic Damage with her Basic Attacks. Guinevere builds up Super Magic each time she deals damage and when she's fully charged, her next Basic Attack becomes guided, dealing 80 (+100% Total Physical Attack) (+90% Total Magic Power) Magic Damage on hit and restoring 80 (+Guinevere's 8% Lost HP) HP. Enemies hit by Guinevere's enhanced Basic Attack, Energy Wave, or Spatial Migration are marked for 5 seconds. Those with 3 marks will be knocked airborne when hit by her Violet Requiem.",
    terms: [
      { name: "Damage Increase" },
      {
        name: "Magic Basic Attack",
        text: "Deal Magic DMG to enemies. It can trigger ATK Effect and Magic Lifesteal.",
      },
      {
        name: "Regen Effect",
        text: "Attribute that affects the actual HP Regen and Shield. The default ratio is 100%. Actual HP Regen/Shield = Original HP Regen/Shield × (100% + All Regen Effects Increase% - All Regen Effects Decrease%).",
      },
    ],
    scaling: "",
    propertyHead: "",
    heads: [],
    rows: [],
    notes: [
      "Damage increase only applies to Guinevere's skills and basic attack.",
      "Guinevere accumulates 34 Super Magic from basic attacks.",
      "Enhanced Basic Attack range is 4 units.",
      "Applying marks is not affected by Golden Staff Unique Passive - Endless Strike. (see Patch Notes 1.6.66)",
      "The enhanced basic attack will slightly knock back enemies if they're airborne.",
      "The initial Airborne duration of the Mark lasts for 0.4 seconds.",
    ],
    tone: "#f6c177",
    icon: icon("passive"),
    clip: "skill-passive",
  },
  {
    id: "skill-1",
    slot: "Skill 1",
    name: "Energy Wave",
    tags: ["Damage", "Buff"],
    description:
      "Guinevere releases an energy orb in the target direction, dealing 300 to 525 (+125% Total Magic Power) Magic Damage to the first enemy hit and slowing them by 25% for 1.2 seconds. Successfully hitting an enemy reduces all her skill cooldowns by 1 second.",
    terms: [
      MAGIC_SKILL,
      {
        name: "Movement Speed",
        text: "Movement Speed on the battlefield. Usually Calculated and Actual Movement Speed is equal. But when Movement Speed is below 230 or over 420 both Slowdown and Speedup Effect will decay. Calculated Movement Speed = Basic Movement Speed × (100% + All Speedup Effect% - All Slowdown Effect%).",
      },
      {
        name: "CD",
        text: "The time needed for casting the skill one more time, which can be affected by CD Reduction (unless otherwise stated).",
      },
    ],
    scaling: "Level scaling",
    propertyHead: "Properties",
    heads: SIX,
    rows: [
      { label: "Cooldown", values: ["4.0", "4.0", "4.0", "4.0", "4.0", "4.0"] },
      { label: "Base Damage", values: ["300", "345", "390", "435", "480", "525"] },
    ],
    notes: [
      "Guinevere accumulates 34 Super Magic each time she deals damage.",
      "The skill range is 6.35 units long",
    ],
    tone: "#ff8f6b",
    icon: icon("skill-1"),
    clip: "skill-1",
  },
  {
    id: "skill-2",
    slot: "Skill 2",
    name: "Spatial Migration",
    tags: ["Mobility", "CC"],
    description:
      "Guinevere leaps to the target location, dealing 250 to 400 (+80% Total Magic Power) Magic Damage, stunning enemies within it for 1 second. Enemy heroes and Creeps hit will be knocked airborne for 1 second and take 125 to 200 (+50% Total Magic Power) additional Magic Damage. After cast, Guinevere can reactivate the skill in 5 seconds to blink toward the target direction while invisible for 0.5 seconds and leave an illusion behind. If the illusion takes damage, it restores Super Magic for Guinevere and will explode in 1.5 seconds, dealing 100 (+30% Total Magic Power) Magic Damage to nearby enemies.",
    terms: [
      AIRBORNE,
      MAGIC_SKILL,
      { name: "Blink", text: "Movement ability that can pass through obstacles." },
    ],
    scaling: "Level scaling",
    propertyHead: "Properties",
    heads: SIX,
    rows: [
      { label: "Cooldown", values: ["17.0", "16.4", "15.8", "15.2", "14.6", "14.0"] },
      { label: "Base Damage", values: ["250", "280", "310", "340", "370", "400"] },
      { label: "Extra Damage", values: ["125", "140", "155", "170", "185", "200"] },
    ],
    notes: [
      "Guinevere accumulates 34 Super Magic each time she deals damage.",
      "The skill range is 5.3 units far.",
      "Phase 2 of Spatial Migration does not accumulate Super Magic.",
      'This skill was formerly named "Magic Thump".',
      "Guinevere will not be affected by Immobilize and Stun if the skill is already casted.",
      "Guinevere can land much further than she is supposed to by using Flicker.",
      "The illusion does not restore Super Magic for Guinevere when struck by turrets.",
    ],
    tone: "#ff9db8",
    icon: icon("skill-2"),
    icon2: icon("skill-2-blink"),
    clip: "skill-2",
  },
  {
    id: "skill-3",
    slot: "Ultimate",
    name: "Violet Requiem",
    tags: ["Burst", "CC"],
    description:
      "Guinevere creates a force field around her for 2 seconds, attacking nearby enemies 11 times within 2 seconds, dealing 880 to 1320 (+385% Total Magic Power) Magic Damage in total. If the enemy hit is already airborne, they will be knocked airborne again, up to 8 additional times. Guinevere is immune to Crowd Control while casting this skill.",
    terms: [
      AIRBORNE,
      {
        name: "Control Immunity",
        text: "You are immune to enemy CC effects (Suppressed excluded) within the duration.",
      },
      MAGIC_SKILL,
    ],
    scaling: "Level scaling",
    propertyHead: "Properties",
    heads: ["1", "2", "3"],
    rows: [
      { label: "Cooldown", values: ["52.0", "46.0", "40.0"] },
      { label: "Base Damage", values: ["880", "1100", "1320"] },
    ],
    notes: [
      "Each attack deals 80 / 100 / 120 (+35% Total Magic Power) Magic Damage.",
      "Guinevere accumulates 10 Super Magic each time she deals damage.",
      "The skill range is 4.15 units wide",
      "Each airborne hits lasts for 0.44 seconds.",
      "Each attack lands every 0.1818... seconds meaning the final total damage outcome is a bit lower than described.",
    ],
    tone: "#ff6a5f",
    icon: icon("skill-3"),
    clip: "skill-3",
  },
];
