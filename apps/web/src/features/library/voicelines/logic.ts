import type { VoiceCharacter, VoiceItem } from "./types";

/** Lower case, full width forms folded (NFKC), so a Japanese search matches either width. */
export function fold(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

/** Everything a search looks at for one item. */
export function searchText(item: VoiceItem, characterName: string): string {
  return fold(
    [
      characterName,
      item.jp,
      item.en,
      item.sub ?? "",
      item.speaker ?? "",
      item.n > 0 ? String(item.n) : "",
    ].join(" "),
  );
}

/** Every word of the query must be found (in the name, the Japanese or the English). */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = fold(query).split(/\s+/u).filter(Boolean);
  return words.every((w) => haystack.includes(w));
}

export interface Grouped {
  /** Lines of each character, in file order, after the search. */
  lines: Record<string, VoiceItem[]>;
  compilations: Record<string, VoiceItem>;
  trailer: VoiceItem[];
}

export function groupItems(
  items: readonly VoiceItem[],
  characters: readonly VoiceCharacter[],
  query: string,
): Grouped {
  const names = new Map(characters.map((c) => [c.slug as string, c.name]));
  const lines: Record<string, VoiceItem[]> = {};
  const compilations: Record<string, VoiceItem> = {};
  const trailer: VoiceItem[] = [];
  const q = query.trim();
  for (const item of items) {
    if (item.group === "compilation") {
      compilations[item.slug] = item;
      continue;
    }
    if (q && !matchesQuery(searchText(item, names.get(item.slug) ?? item.slug), q)) continue;
    if (item.group === "trailer") trailer.push(item);
    else (lines[item.slug] ??= []).push(item);
  }
  return { lines, compilations, trailer };
}

/** Every playable row in page order: the ten characters, then the trailer clips. */
export function playOrder(grouped: Grouped, characters: readonly VoiceCharacter[]): VoiceItem[] {
  const out: VoiceItem[] = [];
  for (const c of characters) out.push(...(grouped.lines[c.slug] ?? []));
  out.push(...grouped.trailer);
  return out;
}

/** The row after `currentId`, wrapping to the first. With nothing playing it is the first row. */
export function nextAfter(order: readonly VoiceItem[], currentId: string | null): VoiceItem | null {
  if (order.length === 0) return null;
  const i = currentId ? order.findIndex((x) => x.id === currentId) : -1;
  return order[(i + 1) % order.length] ?? null;
}

/** A random row that is not `excludeId` (unless it is the only one). `rnd` is 0 up to 1. */
export function randomFrom(
  order: readonly VoiceItem[],
  excludeId: string | null,
  rnd: () => number = Math.random,
): VoiceItem | null {
  const pool = order.length > 1 ? order.filter((x) => x.id !== excludeId) : order;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))] ?? null;
}

/** 126.7 gives `2:07`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 1.46 gives `1.5 s`, 126.7 gives `2:07`. */
export function shortLength(seconds: number): string {
  return seconds < 10 ? `${seconds.toFixed(1)} s` : clock(seconds);
}

/** The name a downloaded file gets: the original file name on disk (`NN_<Japanese>.flac`). */
export function downloadName(item: VoiceItem): string {
  const nn = String(item.n).padStart(2, "0");
  const base = item.group === "trailer" ? `trailer-${nn}_${item.jp}` : `${nn}_${item.jp}`;
  // Windows and macOS refuse these characters in a file name.
  return `${base.replace(/[\\/:*?"<>|]+/gu, "")}.flac`;
}

/** Whole minutes and seconds of a total, for example `1 h 04 min`. */
export function totalLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")} min`;
}
