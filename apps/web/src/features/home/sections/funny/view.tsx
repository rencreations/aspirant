import { FUNNY } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="funny" note="Tetra, the kite and the two drones" />,
    text: (
      <div className={styles.centreBox}>
        <h2 className={styles.title + " " + styles.titleSmall}>{FUNNY.title}</h2>
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
