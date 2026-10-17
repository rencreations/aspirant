import { entitiesOfKind, type EntityKind } from "@/content/entities";
import { wordsToKnow } from "@/content/world";

export type GlossaryKind = "place" | "term" | "org";

export interface GlossaryEntry {
  readonly id: string;
  readonly label: string;
  readonly kind: GlossaryKind;
  readonly text: string;
  readonly chapterId?: string;
  /** Listed in the story's own "Words to know". */
  readonly listed: boolean;
}

const KINDS: readonly EntityKind[] = ["term", "place", "org"];

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The glossary: the story's own "Words to know" (in the story's wording), plus every term,
 * place and group from the entity glossary. Entries are merged by entity id, A to Z.
 */
export function buildGlossary(): readonly GlossaryEntry[] {
  const byId = new Map<string, GlossaryEntry>();
  for (const kind of KINDS) {
    for (const entity of entitiesOfKind(kind)) {
      byId.set(entity.id, {
        id: entity.id,
        label: entity.label,
        kind: kind as GlossaryKind,
        text: entity.short,
        ...(entity.firstChapter ? { chapterId: entity.firstChapter } : {}),
        listed: false,
      });
    }
  }
  for (const word of wordsToKnow) {
    const key = word.entityId ?? `word-${word.term}`;
    const existing = byId.get(key);
    byId.set(key, {
      id: key,
      label: word.term,
      kind: existing?.kind ?? "term",
      text: capital(word.text),
      ...(existing?.chapterId ? { chapterId: existing.chapterId } : {}),
      listed: true,
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
}
