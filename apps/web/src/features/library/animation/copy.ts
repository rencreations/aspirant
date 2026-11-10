import type { CharacterSlug } from "@/lib/slugs";

import type { AnimClip } from "./types";

/** The five pairs, in the order of the ring. */
const PAIRS: ReadonlyArray<readonly [CharacterSlug, CharacterSlug]> = [
  ["selena", "obsidia"],
  ["guinevere", "vexana"],
  ["lesley", "change"],
  ["ruby", "angela"],
  ["layla", "fanny"],
];

/** The pair a character belongs to, as two slugs (the character first). */
export function pairOf(slug: CharacterSlug): readonly [CharacterSlug, CharacterSlug] | null {
  const pair = PAIRS.find((p) => p.includes(slug));
  if (!pair) return null;
  return pair[0] === slug ? pair : [pair[1], pair[0]];
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const count = (n: number, one: string, many: string) =>
  `${WORDS[n] ?? String(n)} ${n === 1 ? one : many}`;

/** One plain line that says what a character's animation holds, from its clips. */
export function describeClips(clips: readonly AnimClip[]): string {
  const poses = clips.filter((c) => c.kind === "pose").length;
  const shorts = clips.filter((c) => c.kind === "short").length;
  const parts = ["A welcome", "an idle loop"];
  if (poses > 0) parts.push(poses === 1 ? "a close pose" : count(poses, "pose", "poses"));
  if (shorts > 0) parts.push(count(shorts, "clip", "clips"));
  const last = parts.pop();
  return `${parts.join(", ")} and ${last}.`;
}

/** `3` as `03`. */
export const two = (n: number) => String(n).padStart(2, "0");
