/**
 * One spoiler-free line per Aspirant for the introduction cards, written from the book's own
 * description of each (the story's back matter), kept to what a reader knows when she first
 * appears.
 */
export const PORTRAIT_LINES: Readonly<Record<string, string>> = {
  layla: "Top of the Combat Division, with a cannon she built herself.",
  fanny: "A soldier turned transfer student. She flies with blades and a cable.",
  ruby: "The heir of a ruling house on Oro. She built Angela.",
  angela: "An android built by Ruby, learning what warmth, pain and friends are.",
  lesley: "The Academy's Chief Combat Instructor, and a sniper.",
  change: "Director of the Science Division. Mr. Bunny is her best friend.",
  guinevere: "Proud, rich and loyal. She never gives up on a friend.",
  vexana: "Guinevere's quiet partner, who carries a weight she does not share.",
  selena: "A Science Division student who rides a machine called Silverbolt.",
  obsidia: "The first Ender to wake, and the Imperatrix of the Storm Citadel.",
};

/**
 * The chapter in which each Aspirant first appears in the book (0 is the Prologue), in the order
 * the reader meets them. The contents sheet lists the people met so far and no more.
 */
export const FIRST_CHAPTER: ReadonlyArray<readonly [slug: string, chapter: number]> = [
  ["obsidia", 0],
  ["layla", 1],
  ["fanny", 1],
  ["guinevere", 4],
  ["vexana", 4],
  ["lesley", 14],
  ["change", 14],
  ["selena", 17],
  ["ruby", 9],
  ["angela", 9],
];
