"use client";

import { useEffect, useRef } from "react";

import { holdCount } from "./kernel/hold";
import { CUE_AFTER_MS, cueShown } from "./rest-cue";
import styles from "./rest-cue.module.css";

/** The inputs that say the visitor is doing something. They are passive and cost nothing while idle. */
const INPUTS = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown", "scroll"] as const;

/**
 * The cue at a rest (`rest-cue.ts`): a hairline in the lower right corner that appears when the
 * visitor has stood still for a moment between two scenes. One timer, set again by every input;
 * nothing runs while the visitor scrolls. It lives inside the home's root, so the root's
 * `data-home-playing` and `data-open` are what it reads, together with the hold count.
 */
export function RestCue() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.closest<HTMLElement>("[data-home]");
    let last = performance.now();
    let timer = 0;

    const apply = (): void => {
      const root2 = root;
      const on = cueShown({
        open: root2?.dataset.open === "1",
        held: holdCount() > 0 || root2?.dataset.homePlaying !== undefined,
        idleMs: performance.now() - last,
        scrollY: window.scrollY,
        viewH: window.innerHeight,
        docH: document.documentElement.scrollHeight,
      });
      el.dataset.on = on ? "1" : "0";
    };
    const poke = (): void => {
      last = performance.now();
      if (el.dataset.on === "1") el.dataset.on = "0";
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, CUE_AFTER_MS + 30);
    };

    for (const name of INPUTS) window.addEventListener(name, poke, { passive: true });
    // A scene ending or the page opening starts the wait again.
    const observer = new MutationObserver(poke);
    if (root)
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["data-home-playing", "data-open"],
      });
    poke();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      for (const name of INPUTS) window.removeEventListener(name, poke);
    };
  }, []);

  return <div ref={ref} className={styles.cue} data-on="0" aria-hidden="true" />;
}
