"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { REEL_ASPECT, TRACK_SCREENS } from "../layout";
import { useAboutStage } from "../stage-bus";
import styles from "./opening.module.css";

/**
 * The track of the opening: the first screen in flow at its top, and the film's sticky stage for
 * its whole height. It also remembers whether the opening was played: the parts of the first
 * screen come in with their reveal only then (`data-played`). A visit that goes straight to the
 * end (the opening is off, the page was opened part way down) shows them at once, at rest.
 */
export function Track({ children }: { children: ReactNode }) {
  const phase = useAboutStage((s) => s.phase);
  const [played, setPlayed] = useState(false);
  if (phase === "landed" && !played) setPlayed(true);

  return (
    <section
      className={styles.track}
      aria-labelledby="about-title"
      data-about-track=""
      data-played={played ? "" : undefined}
      style={{ "--screens": TRACK_SCREENS, "--aspect": REEL_ASPECT } as CSSProperties}
    >
      {children}
    </section>
  );
}
