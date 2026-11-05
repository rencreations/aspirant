"use client";

import { useRef } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useHotkey } from "@/lib/hooks";
import { routes } from "@/lib/site";

import styles from "./continue-home.module.css";

/**
 * The way on from the shelf. The site is a queue (Home, About, Story, Characters, Collection and
 * back to Home) and every page leads to the next one. Most pages end in a footer you scroll
 * through; the shelf is one screen with nothing to scroll, so it has this button, and the N key
 * does the same as everywhere else.
 */
export function ContinueHome() {
  const router = useTransitionRouter();
  const fired = useRef(false);

  const go = () => {
    if (fired.current || router.isTransitioning()) return;
    fired.current = true;
    audio.blip("click");
    router.push(routes.home, { label: "Home" });
  };

  useHotkey("n", go);

  return (
    <button
      type="button"
      className={`${styles.button} hud-label`}
      aria-label="Continue to Home"
      onClick={go}
    >
      <span className={styles.eyebrow}>Next destination</span>
      <span className={styles.name}>Continue to Home</span>
      <kbd className={styles.key}>N</kbd>
    </button>
  );
}
