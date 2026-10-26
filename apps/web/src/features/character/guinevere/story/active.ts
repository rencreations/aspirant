"use client";

import { useEffect, useState } from "react";

/**
 * The index of the section that crosses the middle of the screen, or -1 above the first one
 * (the opening). `ids` must be stable: pass a module constant.
 */
export function useActiveSection(ids: readonly string[]): number {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(ids.indexOf(e.target.id));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const el of els) if (el) io.observe(el);
    return () => io.disconnect();
  }, [ids]);
  return active;
}
