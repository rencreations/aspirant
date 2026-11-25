import type { ClipForm, ClipRef, ModelEntry, ModelView } from "./types";

/** Two digits: 3 gives "03". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The fraction (0 to 1) a download has reached, never above `cap` until it is done. */
export function fractionOf(received: number, total: number, cap = 0.99): number {
  return total > 0 ? Math.min(cap, received / total) : 0;
}

/** Where a view sits in the list: the entry and the view inside it. */
export interface Place {
  entry: number;
  view: number;
}

/**
 * The entry the address names (`?i=<entry id>`) and the view (`?v=<view id>`). An unknown or empty
 * entry is the first (Selena), an unknown view is the entry's first view. A view id alone finds
 * its entry, so `?v=fanny-blade` works without `?i=`.
 */
export function placeOf(
  entries: ReadonlyArray<Pick<ModelEntry, "id" | "views">>,
  entryId: string,
  viewId: string,
): Place {
  let entry = entries.findIndex((e) => e.id === entryId);
  if (entry < 0 && viewId) entry = entries.findIndex((e) => e.views.some((v) => v.id === viewId));
  if (entry < 0) entry = 0;
  const views = entries[entry]?.views ?? [];
  const view = Math.max(
    0,
    views.findIndex((v) => v.id === viewId),
  );
  return { entry, view };
}

/** The index `step` places on from `from`, round the ends (the list has no end). */
export function stepIndex(from: number, step: number, length: number): number {
  if (length <= 0) return 0;
  return (((from + step) % length) + length) % length;
}

/** Every view of the room, in the order of the list. */
export function flatViews(entries: ReadonlyArray<Pick<ModelEntry, "views">>): ModelView[] {
  return entries.flatMap((e) => e.views);
}

/**
 * The order the views are fetched in behind the first screen: the one on show first, then the
 * ones next to it in the list, nearest first (after it, then before it).
 */
export function fetchOrder(length: number, start: number): number[] {
  const order: number[] = [];
  for (let k = 0; order.length < length; k += 1) {
    for (const i of k === 0 ? [start] : [start + k, start - k]) {
      if (i >= 0 && i < length && !order.includes(i)) order.push(i);
    }
  }
  return order;
}

/** A row of the clip list: one clip, or a group of clips shown as one dropdown. */
export type ClipRow =
  { kind: "clip"; clip: ClipRef } | { kind: "group"; id: string; label: string; clips: ClipRef[] };

/** The clips in rows, a group where its first clip stands. */
export function clipRows(clips: readonly ClipRef[]): ClipRow[] {
  const rows: ClipRow[] = [];
  for (const clip of clips) {
    if (!clip.group) {
      rows.push({ kind: "clip", clip });
      continue;
    }
    const open = rows.find(
      (r): r is Extract<ClipRow, { kind: "group" }> => r.kind === "group" && r.id === clip.group,
    );
    if (open) open.clips.push(clip);
    else
      rows.push({
        kind: "group",
        id: clip.group,
        label: clip.groupLabel ?? clip.group,
        clips: [clip],
      });
  }
  return rows;
}

/** The clips the visitor can pick in a view, for the form on show when it has forms. */
export function clipsOf(view: Pick<ModelView, "clips" | "forms">, form?: string): ClipRef[] {
  if (view.forms?.length) {
    const f: ClipForm | undefined = view.forms.find((x) => x.id === form) ?? view.forms[0];
    return f?.clips ?? [];
  }
  return view.clips ?? [];
}

/** The form a clip of a view with forms belongs to (`normal/idle` is `normal`). */
export function formOfClip(clipId: string): string {
  const at = clipId.indexOf("/");
  return at < 0 ? "" : clipId.slice(0, at);
}

/**
 * Every time a clip has a key, merged across its tracks and sorted, with times closer than
 * `tolerance` taken as one. The timeline draws a tick for each.
 */
export function mergeKeyTimes(
  tracks: ReadonlyArray<ArrayLike<number>>,
  duration: number,
  tolerance = 1 / 240,
): number[] {
  const all: number[] = [];
  for (const t of tracks) for (const x of Array.from(t)) all.push(x);
  all.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of all) {
    if (t < -tolerance || t > duration + tolerance) continue;
    const last = out[out.length - 1];
    if (last === undefined || t - last > tolerance) out.push(Math.min(duration, Math.max(0, t)));
  }
  return out;
}

/** The key nearest to `time`, as an index of `keys` (0 when there are none). */
export function nearestKey(keys: readonly number[], time: number): number {
  if (keys.length === 0) return 0;
  let lo = 0;
  let hi = keys.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((keys[mid] ?? 0) <= time) lo = mid;
    else hi = mid;
  }
  return Math.abs((keys[hi] ?? 0) - time) < Math.abs(time - (keys[lo] ?? 0)) ? hi : lo;
}

/** "1.25 s" for the timeline. */
export function seconds(t: number): string {
  return `${Math.max(0, t).toFixed(2)} s`;
}
