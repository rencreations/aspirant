"use client";

import type { ReactNode } from "react";

import { filmArrive, guinevereArrive, useSwitch } from "./arrive";
import styles from "./arrive.module.css";

/** Wraps the film: it fades in by itself once the liquid in front of it has covered the screen. */
export function FilmArrive({ children }: { children: ReactNode }) {
  const on = useSwitch(filmArrive);
  return (
    <div className={styles.film} data-on={on}>
      {children}
    </div>
  );
}

/**
 * Wraps her best friend's section: once the cream heart has shut over the music film it shows itself
 * by itself, rising a little into place as it fades in (nothing in it is fixed, so it may move).
 */
export function GuinevereArrive({ children }: { children: ReactNode }) {
  const on = useSwitch(guinevereArrive);
  return (
    <div className={styles.guin} data-on={on}>
      {children}
    </div>
  );
}
