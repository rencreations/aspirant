// What the In Game file carries: the clip ids of `scripts/library/models/entries.json` and the
// source clip each one is made from, and the timing of the two form changes.

/** The prefix of every source clip of the normal form. */
export const NORMAL_PREFIX = "selena_silverbolt_raiko_in_game_";
/** The prefix of every source clip of the abyssal form. */
export const ABYSSAL_PREFIX = "selena_silverbolt_raiko_in_game_in_game_abyssal_form_";

/** [id, source clip without its prefix]. The file lists the clips in this order. */
export const NORMAL_CLIPS = [
  ["normal/idle", "fight_idle"],
  ["normal/random-idle", "oddshold1"],
  ["normal/run", "run"],
  ["normal/sprint", "fastrun"],
  ["normal/random-move", "oddsmove1"],
  ["normal/attack-1", "attack1"],
  ["normal/attack-2", "attack2"],
  ["normal/skill-1", "skill1"],
  ["normal/skill-2", "skill2"],
  ["normal/stunned", "verigo"],
  ["normal/recall", "recall"],
  ["normal/landing", "landing"],
  ["normal/dead", "dead"],
  ["normal/respawn", "birth"],
  // The owner's "Normal-Abyssal Transform" and "Normal-Normal Transform".
  ["normal/to-abyssal", "skill3_1"],
  ["normal/from-abyssal", "skill3_2"],
];

export const ABYSSAL_CLIPS = [
  ["abyssal/idle", "fight_idle"],
  ["abyssal/run", "run"],
  ["abyssal/sprint", "fastrun"],
  ["abyssal/attack-1", "attack1"],
  ["abyssal/attack-2", "attack2"],
  // The owner's mapping: Skill 1 is attack3.
  ["abyssal/skill-1", "attack3"],
  ["abyssal/skill-2", "skill2"],
  ["abyssal/stunned", "verigo"],
  ["abyssal/dead", "dead"],
  // The owner's "Abyssal-Abyssal Transform" and "Abyssal-Normal Transform".
  ["abyssal/from-normal", "skill3_2"],
  ["abyssal/to-normal", "skill3"],
];

/** Source clips that are left out on purpose. */
export const DROPPED = ["attack4"];

/**
 * Meshes that are left out. body_03 of the normal form is the game's flow light: a strip that
 * repeats the sash, drawn additively with a scrolling picture (liuguang_2). A web file cannot
 * scroll it, and standing still it reads as a pale smear beside the sash that also hangs up to
 * 0.25 m under the ground. The sash itself (body_01) keeps all its colour.
 */
export const DROPPED_MESHES = ["selena_silverbolt_raiko_in_game_body_03"];

/**
 * The abyssal source starts every clip at its frame 1 (1/30 s); the normal one at frame 0. The
 * build moves the abyssal clips to start at 0, so both forms count time the same way.
 */
export const ABYSSAL_SHIFT = 1 / 30;

/** A clip stops moving when no channel changes by more than this from one key to the next. */
export const STILL_EPS = 1e-4;

/**
 * Clips that end where the game sends the form under the ground: they are cut at the last key
 * before the pelvis drops below `SINK_Y`, so no frame (and no blend) can show the sink.
 */
export const CUT_AT_SINK = ["normal/to-abyssal"];
export const SINK_Y = -0.2;

/** The pelvis: the joint the form change and the carry are measured on. */
export const PELVIS = "Bip001 Pelvis";

/**
 * The form changes. Times are seconds of the finished (shifted and trimmed) clips. `hideAt: "end"`
 * means the first clip's last key. README.md says how the numbers were chosen.
 *  - toAbyssal: the normal form jumps, curls and is sent under the ground right after its key at
 *    0.2667 s (the clip is cut there). The abyssal clip starts curled in the air at the same
 *    place, so it plays from its first key: the hand-off the game authored.
 *  - toNormal: the abyssal clip never goes under the ground; it ends in the air at 0.3 s and the
 *    game swaps the model there. The normal clip starts from its first key.
 * `carry`: the second form starts where the first one's pelvis was and the gap closes over
 * `carryFor` seconds (eased), written as a translation track on the second form's root.
 */
export const FORMS = {
  roots: { normal: "normal", abyssal: "abyssal" },
  toAbyssal: {
    first: "normal/to-abyssal",
    hideAt: "end",
    second: "abyssal/from-normal",
    secondFrom: 0,
    carry: true,
    carryFor: 0.4,
  },
  toNormal: {
    first: "abyssal/to-normal",
    hideAt: "end",
    second: "normal/from-abyssal",
    secondFrom: 0,
    carry: true,
    carryFor: 0.4,
  },
};
