"use client";

import { useEffect, useRef, useState } from "react";

import { StarButton } from "@/components/ui/star-button";
import { useHotkey } from "@/lib/hooks";
import { selectIsOpen, useHomeFlow } from "@/lib/home-flow";

import { FOOTER } from "./content";
import styles from "./home.module.css";
import { useHomeHandoff } from "./kernel/handoff";
import { screensToEnd } from "./kernel/scroll";

/**
 * The way to About arms when the end of the page is this close (in screens), and is called off if the
 * visitor scrolls back further than `CANCEL_BEYOND`. The footer is about a screen long, so these are
 * "98 percent" and "94 percent" of its length, as the other pages' footers arm.
 */
const ARM_WITHIN = 0.025;
const CANCEL_BEYOND = 0.07;
/** How long the end must be held before the page changes (the visitor can still turn back). */
const LOCK_MS = 520;

/**
 * The end of the home page: the Continue button, the N key, and the scroll to the very end of the
 * page all take the visitor to About. It reads the document, not the scene, so it works the same
 * before the stage has started and with no WebGL. The change itself is `kernel/handoff.ts`.
 */
export function FooterAction() {
  const go = useHomeHandoff();
  const goRef = useRef(go);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    goRef.current = go;
  });

  const open = () => {
    if (!selectIsOpen(useHomeFlow.getState())) return;
    setAnnounce("Opening About.");
    goRef.current();
  };

  useHotkey("n", open);

  useEffect(() => {
    let raf = 0;
    let lock = 0;
    const read = () => {
      raf = 0;
      if (!selectIsOpen(useHomeFlow.getState())) return;
      const left = screensToEnd(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      if (left <= ARM_WITHIN && !lock) {
        lock = window.setTimeout(() => {
          lock = 0;
          const now = screensToEnd(
            window.scrollY,
            document.documentElement.scrollHeight,
            window.innerHeight,
          );
          if (now <= CANCEL_BEYOND) goRef.current();
        }, LOCK_MS);
      } else if (left > CANCEL_BEYOND && lock) {
        window.clearTimeout(lock);
        lock = 0;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(lock);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <>
      <div className={styles.actions}>
        <StarButton
          size="lg"
          pulse
          onClick={open}
          aria-keyshortcuts="N"
          aria-label={FOOTER.buttonName}
        >
          {FOOTER.button}
        </StarButton>
      </div>
      <p className={styles.hint}>{FOOTER.hint}</p>
      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>
    </>
  );
}
