"use client";

import { useSyncExternalStore } from "react";

import type { Dir } from "./gates";

/**
 * How far the visitor has scrolled into the threshold of a boundary, 0 to 1, for the one section
 * that shows it (the interactive drama draws it at its top and bottom edges). The gates write it
 * (`setThresholdProgress`) only when it has changed by a percent, so reading it re-renders rarely.
 */
const values = new Map<string, number>();
const listeners = new Set<() => void>();

const keyOf = (id: string, dir: Dir) => `${id}:${dir}`;

export function setThresholdProgress(id: string, dir: Dir, p: number): void {
  const next = Math.max(0, Math.min(1, p));
  const key = keyOf(id, dir);
  const prev = values.get(key) ?? 0;
  if (next === prev) return;
  if (Math.abs(next - prev) < 0.01 && next !== 0 && next !== 1) return;
  values.set(key, next);
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useThresholdProgress(id: string, dir: Dir): number {
  return useSyncExternalStore(
    subscribe,
    () => values.get(keyOf(id, dir)) ?? 0,
    () => 0,
  );
}
