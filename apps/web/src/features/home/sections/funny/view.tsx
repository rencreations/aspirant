import { FUNNY } from "../../content";
import styles from "../../home.module.css";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import own from "./funny.module.css";

/**
 * What the server draws for the section: the title, the line and the button of the owner's copy.
 * The scene (Tetra, the kite, Silverbolt, the doll and the two drones) is all in the canvas; the
 * words sit in the lower part of the screen so the two drones, big in the middle, never stand
 * behind them.
 */
export function view(): SectionMarkup {
  return {
    text: (
      <div className={`${styles.centreBox} ${own.box}`}>
        <h2 className={`${styles.title} ${styles.titleSmall}`}>{FUNNY.title}</h2>
        <p className={styles.lead}>{FUNNY.body}</p>
        <div className={styles.actions}>
          <Pill href={FUNNY.button.href} label="Story">
            {FUNNY.button.label}
          </Pill>
        </div>
      </div>
    ),
  };
}
