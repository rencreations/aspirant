"use client";

import { useCallback, useEffect, useState } from "react";

function readParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * One value kept in the address (`?who=layla`), so a view can be shared and the back button
 * keeps working. It starts with `initial` on the server and on the first render, then reads the
 * address. Setting an empty value removes the parameter.
 */
export function useQueryState(key: string, initial = ""): [string, (next: string) => void] {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(readParam(key) ?? initial);
    const onPop = () => {
      setValue(readParam(key) ?? initial);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [key, initial]);

  const set = useCallback(
    (next: string) => {
      setValue(next);
      const url = new URL(window.location.href);
      if (next && next !== initial) url.searchParams.set(key, next);
      else url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url);
    },
    [key, initial],
  );

  return [value, set];
}
