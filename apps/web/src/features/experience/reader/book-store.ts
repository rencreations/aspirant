"use client";

/**
 * Lazy Part loading for the reader. A Part file is fetched once, then its chapters mount one
 * at a time in idle time so a big Part never blocks scrolling. A jump asks for every chapter of
 * its Part at once.
 */
import { create } from "zustand";

import type { PartFile } from "@/content/story-types";
import { asset } from "@/lib/asset";

import { getPartMeta } from "./story-data";

interface BookState {
  /** Loaded Part files by Part number. */
  readonly files: Readonly<Partial<Record<number, PartFile>>>;
  /** How many chapters of each Part are mounted (book order inside the Part). */
  readonly mounted: Readonly<Partial<Record<number, number>>>;
  /** Parts whose last fetch failed. */
  readonly failed: Readonly<Partial<Record<number, true>>>;
}

export const useBook = create<BookState>()(() => ({ files: {}, mounted: {}, failed: {} }));

const inflight = new Map<number, Promise<PartFile | null>>();
const mountAll = new Set<number>();
const stepping = new Set<number>();

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

function whenIdle(cb: () => void) {
  const w = window as IdleWindow;
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 180 });
  else window.setTimeout(cb, 24);
}

function chapterCount(n: number): number {
  return getPartMeta(n)?.chapterIds.length ?? 0;
}

function setMounted(n: number, count: number) {
  useBook.setState((s) => ({ mounted: { ...s.mounted, [n]: count } }));
}

/** Mount the next chapter of a loaded Part in idle time, until all are mounted. */
function stepMount(n: number) {
  if (stepping.has(n)) return;
  stepping.add(n);
  const step = () => {
    const total = chapterCount(n);
    const done = useBook.getState().mounted[n] ?? 0;
    if (mountAll.has(n) || done >= total) {
      setMounted(n, total);
      stepping.delete(n);
      return;
    }
    setMounted(n, done + 1);
    whenIdle(step);
  };
  whenIdle(step);
}

/**
 * Load a Part (1 to 12). Resolves with the file, or null when it cannot be fetched.
 * `all` mounts every chapter of the Part right away (for jumps).
 */
export function ensurePart(n: number, { all = false }: { all?: boolean } = {}) {
  const meta = getPartMeta(n);
  if (!meta) return Promise.resolve(null);
  if (all) mountAll.add(n);
  const have = useBook.getState().files[n];
  if (have) {
    if (all) setMounted(n, chapterCount(n));
    return Promise.resolve(have);
  }
  let pending = inflight.get(n);
  if (!pending) {
    pending = fetch(asset(meta.file))
      .then((res) => {
        if (!res.ok) throw new Error(`Part ${n}: ${res.status}`);
        return res.json() as Promise<PartFile>;
      })
      .then((file) => {
        useBook.setState((s) => {
          const failed = { ...s.failed };
          delete failed[n];
          return { files: { ...s.files, [n]: file }, failed };
        });
        if (mountAll.has(n)) setMounted(n, chapterCount(n));
        else stepMount(n);
        return file;
      })
      .catch(() => {
        inflight.delete(n);
        useBook.setState((s) => ({ failed: { ...s.failed, [n]: true } }));
        return null;
      });
    inflight.set(n, pending);
  }
  return pending;
}
