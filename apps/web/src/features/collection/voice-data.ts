/**
 * Voice rows for the archive. The text comes from the content module, which is loaded in its
 * own chunk (about 380 lines); the durations come from the catalog.
 */
import { pairs } from "@/content/pairs";
import type { PairId, Slug } from "@/content/types";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { matchesQuery } from "./filter";

export interface VoiceRow {
  slug: Slug;
  n: number;
  jp: string;
  en: string;
  file: string;
  durationSec: number;
}

export type VoiceTable = Readonly<
  Record<Slug, ReadonlyArray<{ n: number; jpTitle: string; en: string; file: string }>>
>;

export function voicePair(slug: Slug): PairId {
  return pairs.find((p) => p.members.includes(slug))?.id ?? "fanny-layla";
}

/** Join the content text with the catalog durations. */
export function buildVoiceRows(
  table: VoiceTable,
  durations: Readonly<Record<Slug, readonly number[]>>,
): VoiceRow[] {
  const rows: VoiceRow[] = [];
  for (const slug of Object.keys(table) as Slug[]) {
    for (const line of table[slug]) {
      rows.push({
        slug,
        n: line.n,
        jp: line.jpTitle,
        en: line.en,
        file: line.file,
        durationSec: durations[slug]?.[line.n - 1] ?? 0,
      });
    }
  }
  return rows;
}

/** Search the character's name, the Japanese title and the English translation. */
export function voiceMatches(row: VoiceRow, query: string): boolean {
  return matchesQuery(`${CHARACTER_NAMES[row.slug]} ${row.jp} ${row.en}`.toLowerCase(), query);
}

/** One line of each character, then the second line of each, and so on. */
export function roundRobin(rows: readonly VoiceRow[]): VoiceRow[] {
  const by = new Map<Slug, VoiceRow[]>();
  for (const row of rows) by.set(row.slug, [...(by.get(row.slug) ?? []), row]);
  const lists = [...by.values()];
  const out: VoiceRow[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const row = l[i];
      if (row) out.push(row);
    }
  }
  return out;
}
