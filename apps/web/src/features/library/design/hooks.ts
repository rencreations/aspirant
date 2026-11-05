"use client";

import { useEffect, useRef, useState } from "react";

/** The width of an element, kept up to date. Zero until it is measured. */
export function useWidth(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const read = () => {
      setWidth(Math.floor(el.getBoundingClientRect().width));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [el]);
  return [setEl, width];
}

/** True once the element has come near the screen. It stays true. */
export function useSeen<T extends HTMLElement>(
  margin = "240px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  // Without IntersectionObserver nothing could say when to show it, so it shows at once.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: `0px 0px ${margin} 0px` },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [seen, margin]);
  return [ref, seen];
}
