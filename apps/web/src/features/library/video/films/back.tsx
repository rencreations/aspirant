"use client";

import { useMemo, useSyncExternalStore } from "react";

import { BackToCollection } from "../../shell/room-chrome";
import { returnOf, type ReturnTarget } from "../links";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
  };
}

const fromKey = () => returnOf(window.location.search)?.key ?? "";
const serverKey = () => "";

/**
 * The room the visitor came from (`&from=music` on a link made by `videoHref`), or null. Read from
 * the address after the page has started (the built page has no query), and kept when the strip
 * rewrites `?i=` (it keeps the other parameters).
 */
function useReturnTarget(): ReturnTarget | null {
  const key = useSyncExternalStore(subscribe, fromKey, serverKey);
  return useMemo(() => (key ? returnOf(`?from=${key}`) : null), [key]);
}

/** The way out of the Films room: back to the room that opened the film, else to the shelf. */
export function FilmsBack() {
  const target = useReturnTarget();
  return <BackToCollection tone="light" href={target?.href} label={target?.label} />;
}
