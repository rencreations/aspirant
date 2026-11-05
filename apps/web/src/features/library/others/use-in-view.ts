"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True once the element has come on screen (and stays true), for a reveal that plays once.
 * Without IntersectionObserver the element simply counts as seen.
 */
export function useSeen<T extends Element>(
  margin = "0px 0px -8% 0px",
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  // Without IntersectionObserver the element simply counts as seen. (The sections only exist
  // after the data has loaded in the browser, so this never runs on the server.)
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.05 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [margin]);
  return [ref, seen];
}

/** True while the element is on screen (it changes both ways), for something that plays only in view. */
export function useOnScreen<T extends Element>(margin = "80px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        setOn(entries[entries.length - 1]?.isIntersecting ?? false);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [margin]);
  return [ref, on];
}
