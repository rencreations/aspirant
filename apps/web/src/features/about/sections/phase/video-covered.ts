"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether something covers the page: the site's player or a viewer, which are dialogs set
 * straight into the body by whichever part opened them. The previews of the video decks hold
 * still under one, also when another part of the page opened it. The parts share no signal for
 * this, so the body's own list of children is watched, by one observer for all the decks and only
 * while a deck asks. Nothing is written.
 */

const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
let covered = false;

function read(): void {
  const next = document.body.querySelector(':scope > [role="dialog"]') !== null;
  if (next === covered) return;
  covered = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(read);
    observer.observe(document.body, { childList: true });
    read();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    observer?.disconnect();
    observer = null;
    covered = false;
  };
}

const now = () => covered;
const never = () => false;

export function usePageCovered(): boolean {
  return useSyncExternalStore(subscribe, now, never);
}
