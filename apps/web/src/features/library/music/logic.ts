import { asset } from "@/lib/asset";
import { libUrl } from "@/lib/library";

import type { MusicCover, MusicItem, MusicKind } from "./types";

/** The kind of a track, as the title block names it. */
export const KIND_LABEL: Record<MusicKind, string> = {
  song: "Song",
  theme: "Theme",
  piece: "Piece",
  compilation: "Long listen",
};

/** The address of a cover picture: a library file at `size`, or a picture of the site. */
export function coverUrl(cover: MusicCover, size: "t" | "p" = "t"): string {
  if (cover.site) return asset(`/${cover.site.replace(/^\/+/u, "")}`);
  const key = cover[size] ?? cover.p ?? cover.t ?? "";
  return key ? libUrl(key) : "";
}

/** The address of the face of a track's disc, or the cover when the data has no face. */
export function discUrl(item: MusicItem): string {
  return item.disc ? libUrl(item.disc) : coverUrl(item.cover, "p");
}

/** 126.7 gives `2:07`; 855.5 gives `14:16`. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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

/** The rows of the title block: each credit, then the release. (The length is on the Play button.) */
export function infoRows(item: MusicItem): Array<{ label: string; value: string }> {
  const rows = item.credits.map((c) => ({ label: c.role, value: c.name }));
  if (rows.length === 0)
    rows.push({
      label: "Credit",
      value: item.kind === "compilation" ? "Six tracks in one listen" : "Not named in the sources",
    });
  rows.push({ label: "Released", value: item.released ?? "Not dated" });
  return rows;
}

/** `05 / 09`. */
export function counter(index: number, count: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(index + 1)} / ${pad(count)}`;
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

/**
 * The track after (or before) the current one in `queue`. The room has no end, so past the last
 * track the first comes back (and back past the first, the last). Null when `currentId` is not
 * queued.
 */
export function stepIn(
  queue: readonly MusicItem[],
  currentId: string | null,
  direction: 1 | -1,
): MusicItem | null {
  const n = queue.length;
  const i = queue.findIndex((t) => t.id === currentId);
  if (i === -1 || n === 0) return null;
  return queue[(((i + direction) % n) + n) % n] ?? null;
}

/** Add `item` at the end unless it is already queued. */
export function append(queue: readonly MusicItem[], item: MusicItem): MusicItem[] {
  return queue.some((t) => t.id === item.id) ? [...queue] : [...queue, item];
}

/** The index of the track a link names (`?i=`), or 0. */
export function indexOfId(items: readonly MusicItem[], id: string | null): number {
  if (!id) return 0;
  const i = items.findIndex((t) => t.id === id);
  return i === -1 ? 0 : i;
}
