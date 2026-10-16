import { wrap } from "./math";

/** The ten Aspirants in queue order (the roster order in characters.md). The queue loops. */
export const CHARACTER_SLUGS = [
  "fanny",
  "layla",
  "ruby",
  "angela",
  "lesley",
  "change",
  "guinevere",
  "vexana",
  "obsidia",
  "selena",
] as const;

export type CharacterSlug = (typeof CHARACTER_SLUGS)[number];

/** Short display names for routing labels (nav, footers). Full data lives in @/content. */
export const CHARACTER_NAMES: Readonly<Record<CharacterSlug, string>> = {
  fanny: "Fanny",
  layla: "Layla",
  ruby: "Ruby",
  angela: "Angela",
  lesley: "Lesley",
  change: "Chang'e",
  guinevere: "Guinevere",
  vexana: "Vexana",
  obsidia: "Obsidia",
  selena: "Selena",
};

/** Type guard for route params. */
export function isCharacterSlug(value: string): value is CharacterSlug {
  return (CHARACTER_SLUGS as readonly string[]).includes(value);
}

/** The next character in the looping queue (selena wraps to fanny). */
export function nextSlug(slug: CharacterSlug): CharacterSlug {
  const i = CHARACTER_SLUGS.indexOf(slug);
  return CHARACTER_SLUGS[wrap(i + 1, CHARACTER_SLUGS.length)] ?? CHARACTER_SLUGS[0];
}

/** The previous character in the looping queue (fanny wraps to selena). */
export function prevSlug(slug: CharacterSlug): CharacterSlug {
  const i = CHARACTER_SLUGS.indexOf(slug);
  return CHARACTER_SLUGS[wrap(i - 1, CHARACTER_SLUGS.length)] ?? CHARACTER_SLUGS[0];
}
