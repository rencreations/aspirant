import { skillIcon, type SkillIcon, type VideoName } from "../media";

/**
 * Vexana's skills exactly as the Mobile Legends: Bang Bang wiki lists them
 * (https://mobile-legends.fandom.com/wiki/Vexana, the Abilities section): the official names, the
 * official descriptions, the effect tags, the skill terms, the level tables and the notes. Nothing
 * here is written for the story. The wiki's "to" ranges use a plain "to" instead of a dash, and the
 * square brackets the wiki puts around a scaled figure are left out. The clips are the game's own
 * footage.
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
  /** The wiki's title of the level table. */
  scaling: string;
  /** The first cell of the table header ("Property" for the passive, "Properties" for a skill). */
  propertyHead: string;
  heads: readonly string[];
  rows: readonly SkillRow[];
  /** The wiki's notes, in its order. */
  notes: readonly string[];
  /** The colour of the skill on the dock, the frame and the name. */
  tone: string;
  icon: string;
  /** The same key, when its icon changes (the last skill shows a second icon). */
  icon2?: string;
  clip: VideoName;
}

const icon = (n: SkillIcon) => skillIcon(n);

const SIX = ["1", "2", "3", "4", "5", "6"] as const;

const MAGIC_DAMAGE_SKILL = {
  name: "Magic Damage Skill",
  text: "Deal Magic DMG to enemies. Triggers Spell Vamp.",
} as const;

export const SKILLS: readonly Skill[] = [
  {
    id: "passive",
    slot: "Passive",
    name: "Nether Touch",
    tags: ["Damage"],
    description:
      "Vexana and the Eternal Guard inflict Nether Curse on enemies hit. The Curse lasts 5 seconds and will cause the affected enemy to explode upon death, dealing 108 (+38 × Hero Level) (+60% Total Magic Power) Magic Damage to nearby enemies.",
    terms: [],
    scaling: "Hero level scaling",
    propertyHead: "Property",
    heads: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
    rows: [
      {
        label: "Base Damage",
        values: [
          "108",
          "136",
          "164",
          "192",
          "220",
          "248",
          "276",
          "304",
          "332",
          "360",
          "388",
          "416",
          "444",
          "472",
          "500",
        ],
      },
    ],
    notes: [
      "The damage from Nether Touch Vexana's basic attack applies and refreshes the debuff on nearby enemies.",
    ],
    tone: "#a98bf5",
    icon: icon("passive"),
    clip: "skill-passive",
  },
  {
    id: "skill-1",
    slot: "Skill 1",
    name: "Deathly Grasp",
    tags: ["CC", "AOE"],
    ratio: "Spell Vamp Ratio: 50%",
    description:
      "Vexana unleashes a Deathly Grasp in the target direction, dealing 200 to 300 (+60% Total Magic Power) Magic Damage to enemies in its path. The projectile stops upon hitting an enemy hero, terrifying them and knocking them back, then it explodes, dealing 200 to 300 (+60% Total Magic Power) Magic Damage to nearby enemies and terrifying them for 1 second.",
    terms: [{ name: "Terrify" }, MAGIC_DAMAGE_SKILL],
    scaling: "Level scaling",
    propertyHead: "Properties",
    heads: SIX,
    rows: [
      { label: "Cooldown", values: ["14.0", "13.4", "12.88", "12.2", "11.6", "11.0"] },
      { label: "Mana Cost", values: ["80", "90", "100", "110", "120", "130"] },
      { label: "Base Damage", values: ["200", "220", "240", "260", "280", "300"] },
      { label: "Explosion Damage", values: ["200", "220", "240", "260", "280", "300"] },
    ],
    notes: [
      "CC Immune and Purify makes the caster immune but does not remove the lingering terrify effect, and enemies that approach such units will be terrified.",
    ],
    tone: "#7fe0ff",
    icon: icon("skill-1"),
    clip: "skill-1",
  },
  {
    id: "skill-2",
    slot: "Skill 2",
    name: "Cursed Blast",
    tags: ["AOE"],
    ratio: "Spell Vamp Ratio: 50%",
    description:
      "Vexana marks the target area with the power of the undead, striking it after 0.8 seconds delay and dealing 580 to 850 (+165% Total Magic Power) Magic Damage to enemies hit.",
    terms: [MAGIC_DAMAGE_SKILL],
    scaling: "Level scaling",
    propertyHead: "Properties",
    heads: SIX,
    rows: [
      { label: "Cooldown", values: ["7.0", "6.7", "6.4", "6.1", "5.8", "5.5"] },
      { label: "Mana Cost", values: ["80", "90", "100", "110", "120", "130"] },
      { label: "Base Damage", values: ["580", "634", "689", "743", "797", "850"] },
    ],
    notes: [],
    tone: "#f26ec3",
    icon: icon("skill-2"),
    clip: "skill-2",
  },
  {
    id: "skill-3",
    slot: "Ultimate",
    name: "Eternal Guard",
    tags: ["Summon", "Damage"],
    ratio: "Spell Vamp Ratio: 50%",
    description:
      "Vexana summons an Eternal Guard at the target location, dealing 480 to 720 (+60% Total Magic Power) Magic Damage to enemies hit and knocking them airborne for 0.8 seconds. The Eternal Guard then joins Vexana in battle for 15 seconds. Each of Eternal Guard's attacks deals 200 to 300 (+40% Total Magic Power) (+enemy's 5% Total HP) Magic Damage to enemies in a large area.",
    terms: [],
    scaling: "Level scaling",
    propertyHead: "Properties",
    heads: ["1", "2", "3"],
    rows: [
      { label: "Cooldown", values: ["60.0", "53.0", "46.0"] },
      { label: "Mana Cost", values: ["120", "160", "200"] },
      { label: "Base Damage", values: ["480", "600", "720"] },
      { label: "Slash Damage", values: ["200", "250", "300"] },
      { label: "Extra HP", values: ["1800", "2250", "2700"] },
      { label: "Extra Hybrid Defense", values: ["40", "50", "60"] },
      { label: "Extra Magic Power", values: ["80", "100", "120"] },
    ],
    notes: [
      "Vexana can't have more than one Eternal Guard; the older one will disappear once she summons another one.",
      "Death removes the ability to recall Eternal Guard.",
      "Eternal Guard benefits 100% of Vexana's attributes except its HP (≈ 1800 / 2250 / 2700 (+Vexana's 100% Total HP).)",
      "Eternal Guard is fully affected by Retribution.",
      "It only benefits equipment effects and not non-attribute talents and battle spells.",
      "Its attacks are neither a basic attack effect nor a skill effect but a Magic Damage effect.",
      "Its attack speed cannot be increased or decreased.",
      "Its attack speed is approximately between 1.1 to 1.2.",
      "The Guard prioritizes heroes that are in range and will only attack and chase Vexana's targets; or those attacking Vexana, it will only attack whoever Vexana is targeting if there are no heroes nearby.",
      "The Guard can attack jungle creeps if no other higher priority targets are in range, but it will never deal the last hit.",
    ],
    tone: "#e8b949",
    icon: icon("skill-3"),
    icon2: icon("skill-3-cancel"),
    clip: "skill-3",
  },
];
