"use client";

import { forwardRef, useEffect } from "react";

import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media-store";

import { HERO_LOOP, heroLoopFile } from "../media";
import styles from "./opening.module.css";

/**
 * The hero: one silent recording of her animation that loops with no jump (`media.ts`,
 * `scripts/guinevere/hero-loop.py`) and fills the screen. The recording carries her name, so
 * nothing is laid over it. The page plays and pauses it with the scroll (the opening reads the
 * element through the ref). It starts from the copy the loading bar fetched, or from the file if
 * that has not arrived, and shows its first frame until it plays.
 */
export const HeroVideo = forwardRef<HTMLVideoElement>(function HeroVideo(_props, ref) {
  useEffect(() => {
    if (typeof ref === "function" || !ref?.current) return;
    const el = ref.current;
    el.src = mediaUrl(heroLoopFile().src);
    void el.play().catch(() => undefined);
  }, [ref]);

  return (
    <video
      ref={ref}
      className={styles.heroVideo}
      poster={asset(HERO_LOOP.poster)}
      muted
      loop
      playsInline
      preload="auto"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
});
