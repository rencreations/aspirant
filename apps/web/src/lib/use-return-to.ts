"use client";

import { useMemo, useSyncExternalStore } from "react";

import { returnOf, returnQuery, type ReturnTarget } from "./return-to";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
  };
}

const snapshot = () => returnQuery(window.location.search);
const serverSnapshot = () => "";

/**
 * The page the visitor came from, when the link that opened this page said so (`from=about`, see
 * `lib/return-to.ts`), or null. Every way out of a page that can be opened that way reads it.
 *
 * The built page has no query, so it is null on the server and on the first render, and follows
 * the address from then on (no hydration mismatch). A room that rewrites its own address keeps
 * `from` and `at` in it, so the answer holds for the whole visit.
 */
export function useReturnTo(): ReturnTarget | null {
  const query = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => (query ? returnOf(`?${query}`) : null), [query]);
}
