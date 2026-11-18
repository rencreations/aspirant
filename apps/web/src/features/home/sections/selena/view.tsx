import { SELENA } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="selena" note="Selena in 3D and the drawer" />,
    text: (
      <div className={styles.leftBox}>
        <h2 className={styles.title + " " + styles.titleSmall}>{SELENA.title}</h2>
        <p className={styles.lead}>{SELENA.body}</p>
        <div className={styles.actions}>
          <Pill href={SELENA.button.href} label="Animation">
            {SELENA.button.label}
          </Pill>
        </div>
      </div>
    ),
  };
}
