"use client";

import { useLayoutEffect } from "react";

/**
 * Hides the browser's own scrollbar while the long page is open. The joins lock the scroll and give
 * it back, and a classic scrollbar that disappears and comes back moves the whole page sideways each
 * time. The page's progress is the hairline along the top of the screen, which is the only one.
 * The mark is taken off again when the page closes, so the other pages keep their scrollbar.
 * Mount once (it renders nothing).
 */
export function BareScrollbar() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-bare-scroll", "");
    return () => {
      root.removeAttribute("data-bare-scroll");
    };
  }, []);
  return null;
}
