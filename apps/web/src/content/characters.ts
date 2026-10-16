/**
 * The ten Aspirants, in queue order, with their voice lines joined in.
 *
 * Character data lives in `./characters/<slug>.ts`; voice lines are generated from
 * `voice.md` by `scripts/content/build-characters-voice.mjs` into `./voice.generated.ts`.
 */
import { angela } from "./characters/angela";
import { change } from "./characters/change";
import { fanny } from "./characters/fanny";
import { guinevere } from "./characters/guinevere";
import { layla } from "./characters/layla";
import { lesley } from "./characters/lesley";
import { obsidia } from "./characters/obsidia";
import { ruby } from "./characters/ruby";
import { selena } from "./characters/selena";
import { vexana } from "./characters/vexana";
import { getPair, type Pair } from "./pairs";
import { SLUGS, type Character, type CharacterData, type Slug, type VoiceLine } from "./types";
import { voiceLines } from "./voice.generated";

const data: readonly CharacterData[] = [
  fanny,
  layla,
  ruby,
  angela,
  lesley,
  change,
  guinevere,
  vexana,
  obsidia,
  selena,
];

/** All ten, in queue order: fanny, layla, ruby, angela, lesley, change, guinevere, vexana, obsidia, selena. */
export const characters: readonly Character[] = data.map((character) => ({
  ...character,
  voice: voiceLines[character.slug],
}));

export const characterSlugs: readonly Slug[] = SLUGS;

export function isSlug(value: string): value is Slug {
  return (SLUGS as readonly string[]).includes(value);
}

export function getCharacter(slug: Slug): Character {
  const character = characters.find((candidate) => candidate.slug === slug);
  if (!character) throw new Error(`Unknown character: ${slug}`);
  return character;
}

/** For route params: returns undefined for anything that is not a slug. */
export function findCharacter(value: string): Character | undefined {
  return isSlug(value) ? getCharacter(value) : undefined;
}

/** The next character in the queue. After Selena it loops back to Fanny. */
export function nextCharacter(slug: Slug): Character {
  const index = SLUGS.indexOf(slug);
  return getCharacter(SLUGS[(index + 1) % SLUGS.length] ?? SLUGS[0]);
}

/** The previous character in the queue, looping. */
export function previousCharacter(slug: Slug): Character {
  const index = SLUGS.indexOf(slug);
  return getCharacter(SLUGS[(index - 1 + SLUGS.length) % SLUGS.length] ?? SLUGS[0]);
}

/** The pair (or site grouping) a character belongs to. */
export function pairOf(slug: Slug): Pair {
  return getPair(getCharacter(slug).pair);
}

/** The partner, or `null` for Obsidia and Selena, who have none. */
export function partnerOf(slug: Slug): Character | null {
  const partner = getCharacter(slug).partnerSlug;
  return partner ? getCharacter(partner) : null;
}

/** The voice lines named in `keyQuotes`, in that order. */
export function keyVoiceLines(slug: Slug): readonly VoiceLine[] {
  const character = getCharacter(slug);
  return character.keyQuotes.flatMap((n) => character.voice.filter((line) => line.n === n));
}
