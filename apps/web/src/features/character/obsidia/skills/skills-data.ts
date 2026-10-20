/**
 * Obsidia's skills, from the Mobile Legends: Bang Bang wiki (the hero's page). The numbers are the
 * game's, and this is how she plays in the game. They are not part of the story.
 */
export type ClipId =
  "needle" | "shadowmeld" | "hunt" | "fight" | "intro" | "burst" | "idle" | "interactive";

interface ScalingRow {
  label: string;
  values: readonly string[];
}

export interface Skill {
  id: string;
  slot: string;
  name: string;
  tags: readonly string[];
  /** The icon file in `public/img/obsidia/skills/` (no extension). */
  icon: string;
  /** A second icon, when the skill has one. */
  altIcon?: { file: string; label: string };
  text: readonly string[];
  /** One row per property, one value per skill level. */
  scaling: readonly ScalingRow[];
  notes: readonly string[];
  /** The clip that shows it. */
  clip: ClipId;
  clipNote?: string;
}

const LEVELS_SIX = ["1", "2", "3", "4", "5", "6"] as const;
const LEVELS_THREE = ["1", "2", "3"] as const;

export const SKILLS: readonly Skill[] = [
  {
    id: "return-to-bone",
    slot: "Passive",
    name: "Return to Bone",
    tags: ["Buff"],
    icon: "passive",
    text: [
      "When she deals damage she gains Bone Energy. A basic attack on a minion gives 1 Energy, one on a hero gives 2, and a skill gives 3 times as much. Creeps give none.",
      "At 30 Bone Energy she forms a Bone Shard. She can hold up to 25.",
      "When she makes a basic attack, every Bone Shard strikes the target. Each one deals 7 percent of her Total Physical Attack as Physical Damage, and carries 7 percent of her attack effects.",
    ],
    scaling: [],
    notes: ["The more she fights, the more shards fly with every shot."],
    clip: "fight",
    clipNote: "Her skin in a fight, with the shards flying.",
  },
  {
    id: "abyssal-bone-needle",
    slot: "Skill 1",
    name: "Abyssal Bone Needle",
    tags: ["Damage", "AOE"],
    icon: "skill-1",
    text: [
      "She launches an Abyssal Bone Needle. It deals 325 (+80% Total Physical Attack) Physical Damage to the enemies it hits.",
      "It sets off Return to Bone on the first enemy hero it hits.",
    ],
    scaling: [
      { label: "Cooldown", values: ["4.5", "4.2", "3.9", "3.6", "3.3", "3.0"] },
      { label: "Mana cost", values: ["35", "38", "41", "44", "47", "50"] },
      { label: "Base damage", values: ["325", "360", "395", "430", "465", "500"] },
    ],
    notes: [],
    clip: "needle",
  },
  {
    id: "phantom-shadowmeld",
    slot: "Skill 2",
    name: "Phantom Shadowmeld",
    tags: ["Speed up"],
    icon: "skill-2",
    text: [
      "She descends into the Abyss and takes Shadowmeld Form. For 0.3 seconds she gains 500 percent Movement Speed.",
    ],
    scaling: [
      { label: "Cooldown", values: ["4.5", "4.2", "3.9", "3.6", "3.3", "3.0"] },
      { label: "Mana cost", values: ["35", "40", "45", "50", "55", "60"] },
    ],
    notes: ["While Hunt of Bone holds, this skill is stronger (see below)."],
    clip: "shadowmeld",
  },
  {
    id: "hunt-of-bone",
    slot: "Ultimate",
    name: "Hunt of Bone",
    tags: ["CC", "Mobility"],
    icon: "skill-3-normal",
    altIcon: { file: "skill-3-cancel", label: "Cancel" },
    text: [
      "She shoots Bones of Wrath in the target direction. They deal 125 (+60% Total Physical Attack) Physical Damage and briefly stun the first enemy hero they hit, and she pulls herself close to that hero.",
      "The Bones of Wrath then tether to the enemy, and she cannot move more than 4 units away from it. The enemy cannot use displacement skills, and when it moves it pulls her along. During this time she gains 5 temporary Bone Shards. It lasts 3 seconds.",
      "While the tether holds she can move through obstacles and use basic attacks while moving. Phantom Shadowmeld gets stronger: its duration rises to 1 second and its cooldown drops to a third.",
    ],
    scaling: [
      { label: "Cooldown", values: ["40.0", "35.0", "30.0"] },
      { label: "Mana cost", values: ["100", "50", "0"] },
      { label: "Base damage", values: ["125", "175", "225"] },
    ],
    notes: ["The skill has two icons: one to cast it and one to cancel it."],
    clip: "hunt",
    clipNote: "The tether, with Shadowmeld stronger.",
  },
];

/** The sizes the tables go up to: three levels for the ultimate, six for the others. */
export const levelHead = (n: number): readonly string[] => (n === 3 ? LEVELS_THREE : LEVELS_SIX);

export const OVERVIEW: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Role", value: "Marksman" },
  { label: "Specialty", value: "Finisher, damage" },
  { label: "Lane", value: "Gold lane" },
  { label: "Damage", value: "Physical, ranged basic attacks" },
  { label: "Resource", value: "Mana" },
  { label: "Title", value: "Sovereign of Dark's End" },
];

export const RATINGS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "Durability", value: 2 },
  { label: "Offense", value: 7 },
  { label: "Control effects", value: 1 },
  { label: "Difficulty", value: 4 },
];

export const STATS: ReadonlyArray<{
  label: string;
  first: string;
  fifteenth: string;
  growth: string;
}> = [
  { label: "HP", first: "2320", fifteenth: "4420", growth: "150" },
  { label: "HP regen", first: "6", fifteenth: "9", growth: "0.2143" },
  { label: "Mana", first: "500", fifteenth: "1900", growth: "100" },
  { label: "Mana regen", first: "4", fifteenth: "6.8", growth: "0.2" },
  { label: "Physical attack", first: "120", fifteenth: "204", growth: "6" },
  { label: "Physical defense", first: "17", fifteenth: "75", growth: "4.1429" },
  { label: "Magic defense", first: "15", fifteenth: "50", growth: "2.5" },
  { label: "Attack speed", first: "1", fifteenth: "1.24", growth: "0.0171" },
];

export const STAT_NOTES: readonly string[] = [
  "Critical damage 200 percent. Movement speed 240. Basic attack range 4.6.",
];

export const HOW_IT_FLOWS: readonly string[] = [
  "Every hit builds Bone Energy, and every 30 Energy makes a shard. Skills build it three times as fast as basic attacks.",
  "Abyssal Bone Needle is the cheap way to start: it hits a line, and it wakes the passive on the first hero it touches.",
  "Phantom Shadowmeld is a short dash for getting in and out.",
  "Hunt of Bone ties her to one enemy for three seconds. She gets five shards at once, walks through walls, and her dash comes back in a third of the time.",
];

/** The label of each clip, for its caption. */
export const CLIP_LABEL: Record<ClipId, string> = {
  needle: "Abyssal Bone Needle",
  shadowmeld: "Phantom Shadowmeld",
  hunt: "Hunt of Bone",
  fight: "In a fight",
  intro: "Skin intro",
  burst: "Skin burst",
  idle: "Idle animation",
  interactive: "Interactive animation",
};

/** The clips that are not a skill, for the Showcase tab. */
export const EXTRAS: ReadonlyArray<{ clip: ClipId; title: string; note: string }> = [
  { clip: "fight", title: "In a fight", note: "Her skin in battle, with the shards flying." },
  { clip: "intro", title: "Skin intro", note: "The opening cinematic of the skin." },
  { clip: "burst", title: "Skin burst", note: "The flare of light and fire that follows." },
  { clip: "idle", title: "Idle animation", note: "How she stands on the hero screen." },
  {
    clip: "interactive",
    title: "Interactive animation",
    note: "What she does when she is touched.",
  },
];
