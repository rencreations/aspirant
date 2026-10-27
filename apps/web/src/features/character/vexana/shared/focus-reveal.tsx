"use client";

import { useEffect } from "react";

import { coveredBySection, focusVisible, samplePoints } from "./occlusion";

/** The browser has moved the page to a focused control by now; look once it has had its say. */
const LOOK_MS = 350;
/** Asking again: the pinned sections need the page to be moved in more than one step. */
const AGAIN_MS = 700;
const TRIES = 3;

/**
 * Keeps a control that has keyboard focus in sight. The long page pins its sections inside taller
 * wrappers and holds the page at the joins between them, so the browser's own "scroll the focused
 * control into view" can leave it below the screen (the play button of the film, the controls of
 * the stream) or under another section. When that is so a moment after the focus arrives, the
 * control is brought to the middle of the screen, a few times if the page needs it. Only focus that
 * came from the keyboard counts; a click never moves the page. Mount once (it renders nothing).
 */
export function FocusReveal() {
  useEffect(() => {
    const root = document.querySelector("[data-vexana]");
    if (!root) return;
    let timer = 0;

    const reveal = (el: HTMLElement, tries: number) => {
      if (!el.isConnected || document.activeElement !== el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const seen = focusVisible(r, vw, vh);
      if (seen === "undrawn") return;
      let ok = seen === "ok";
      if (ok) {
        const hits = samplePoints(r, vw, vh).map(([x, y]) => document.elementFromPoint(x, y));
        ok = !coveredBySection(el, hits);
      }
      if (ok) return;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      if (tries + 1 < TRIES) timer = window.setTimeout(() => reveal(el, tries + 1), AGAIN_MS);
    };

    const onFocus = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      let keyboard = false;
      try {
        keyboard = el.matches(":focus-visible");
      } catch {
        /* an old browser: leave the page alone */
      }
      if (!keyboard) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => reveal(el, 0), LOOK_MS);
    };
    root.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener("focusin", onFocus);
    };
  }, []);
  return null;
}
