import { asset } from "@/lib/asset";
import { libUrl } from "@/lib/library";

import type { MusicCover, MusicItem, MusicKind } from "./types";

export const KIND_LABELS: Record<MusicKind, string> = {
  song: "Songs",
  theme: "Themes",
  piece: "Pieces",
  compilation: "Long listen",
};

export const KIND_ORDER: readonly MusicKind[] = ["song", "theme", "piece", "compilation"];

/** The address of a cover picture: a library file at `size`, or a picture of the site. */
export function coverUrl(cover: MusicCover, size: "t" | "p" = "t"): string {
  if (cover.site) return asset(`/${cover.site.replace(/^\/+/u, "")}`);
  const key = cover[size] ?? cover.p ?? cover.t ?? "";
  return key ? libUrl(key) : "";
}

export interface MusicFilter {
  q: string;
  kind: string;
  who: string;
}

function fold(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function searchText(item: MusicItem): string {
  return fold(
    [
      item.title,
      item.ep ?? "",
      item.about,
      item.tags.join(" "),
      item.chars.join(" "),
      item.credits.map((c) => c.name).join(" "),
      item.chapters?.map((c) => c.title).join(" ") ?? "",
    ].join(" "),
  );
}

export function filterTracks(items: readonly MusicItem[], f: MusicFilter): MusicItem[] {
  const words = fold(f.q).split(/\s+/u).filter(Boolean);
  return items.filter((item) => {
    if (f.kind && item.kind !== f.kind) return false;
    if (f.who && !item.chars.some((c) => c === f.who)) return false;
    if (words.length === 0) return true;
    const hay = searchText(item);
    return words.every((w) => hay.includes(w));
  });
}

/** 126.7 gives `2:07`; 855.5 gives `14:16`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Whole minutes of a total, for example `33 min`. */
export function totalLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")} min`;
}

/** The credit line under a title: `Vocals: Yoshino Nanjo`, or what the sources lack. */
export function creditSummary(item: MusicItem): string {
  const vocal = item.credits.find((c) => c.role === "Vocals");
  const lead = vocal ?? item.credits[0];
  if (lead) return `${lead.role}: ${lead.name}`;
  return item.kind === "compilation"
    ? "Six tracks in one listen"
    : "Credit not named in the sources";
}

/** File name of the download: the title and the extension of the file. */
export function downloadName(item: MusicItem): string {
  const key = item.orig ?? item.src;
  const ext = /\.([a-z0-9]+)$/iu.exec(key)?.[1] ?? "m4a";
  const base =
    item.title
      .replace(/[\\/:*?"<>|]+/gu, "")
      .replace(/\s+/gu, " ")
      .trim() || "track";
  return `${base}.${ext}`;
}

/** The track after (or before) the current one in `queue`, or null at the end. */
export function stepIn(
  queue: readonly MusicItem[],
  currentId: string | null,
  direction: 1 | -1,
): MusicItem | null {
  const i = queue.findIndex((t) => t.id === currentId);
  if (i === -1) return null;
  return queue[i + direction] ?? null;
}

/** Put `item` right after the current track (or at the end when `afterId` is not queued). Never twice. */
export function insertNext(
  queue: readonly MusicItem[],
  item: MusicItem,
  afterId: string | null,
): MusicItem[] {
  const rest = queue.filter((t) => t.id !== item.id);
  const i = rest.findIndex((t) => t.id === afterId);
  if (i === -1) return [...rest, item];
  return [...rest.slice(0, i + 1), item, ...rest.slice(i + 1)];
}

/** Add `item` at the end unless it is already queued. */
export function append(queue: readonly MusicItem[], item: MusicItem): MusicItem[] {
  return queue.some((t) => t.id === item.id) ? [...queue] : [...queue, item];
}
