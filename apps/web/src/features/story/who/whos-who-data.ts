import { characters, keyVoiceLines } from "@/content/characters";
import { getPair } from "@/content/pairs";
import { whoIsWho } from "@/content/world";
import type { CharacterSlug } from "@/lib/slugs";

/** Everything one slat needs, so the client bundle does not carry the whole character data. */
export interface WhoPerson {
  readonly slug: CharacterSlug;
  readonly name: string;
  readonly title: string;
  readonly text: string;
  readonly colour: string;
  readonly partnerSlug: string | null;
  readonly pairId: string;
  readonly pairNames: string;
  readonly pairKind: "partners" | "creator-and-creation";
  readonly pairColours: readonly [string, string];
  readonly voice: { readonly file: string; readonly en: string } | null;
}

/** The ten in queue order, with the back matter's "who is who" text and one voice line each. */
export function buildPeople(): readonly WhoPerson[] {
  return characters.map((c) => {
    const row = whoIsWho.rows.find((r) => r.entityId === c.slug);
    const pair = getPair(c.pair);
    const line = keyVoiceLines(c.slug)[0];
    return {
      slug: c.slug,
      name: c.name,
      title: row?.title ?? c.aspirantName,
      text: row?.text ?? c.tagline,
      colour: c.palette.primary,
      partnerSlug: c.partnerSlug,
      pairId: pair.id,
      pairNames: pair.names,
      pairKind: pair.kind,
      pairColours: pair.colours,
      voice: line ? { file: line.file, en: line.en } : null,
    };
  });
}

/** The "also in the story" list from the back matter. */
export function buildAlso(): ReadonlyArray<{ readonly name: string; readonly text: string }> {
  return whoIsWho.also.map((a) => ({ name: a.name, text: a.text }));
}
