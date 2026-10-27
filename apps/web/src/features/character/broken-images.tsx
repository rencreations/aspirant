"use client";

import { useEffect } from "react";

/** An image that did not arrive leaves nothing behind: no broken-image mark and no alt text. */
function hide(img: HTMLImageElement) {
  img.style.visibility = "hidden";
}

/**
 * Put it once in a page. A picture that fails (a missing file, a connection that dropped) is
 * hidden, so the page keeps its colours and layout instead of showing a broken-image mark or the
 * picture's description in plain text. Pictures that had already failed before the page woke up
 * are hidden too.
 */
export function BrokenImages() {
  useEffect(() => {
    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) hide(e.target);
    };
    // `error` does not bubble, so it is heard on the way down.
    document.addEventListener("error", onError, true);
    for (const img of document.images) {
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) hide(img);
    }
    return () => {
      document.removeEventListener("error", onError, true);
    };
  }, []);
  return null;
}
