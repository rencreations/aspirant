"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * True once the element has come into view (and stays true). Used to start the short reveal of a
 * row: the cards rise and fade in, one after the other, when their row arrives on screen.
 */
export function useReveal<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    // Every browser the site supports has IntersectionObserver.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [seen]);

  return [ref, seen];
}
