import { MUSIC } from "../../content";
import styles from "../../home.module.css";
import { Pill, Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="music" note="the gramophone and the records" />,
    text: (
      <>
        <h2 className={styles.title + " " + styles.titleSmall}>{MUSIC.title}</h2>
        <div className={styles.actions}>
          <Pill href={MUSIC.button.href} label="Music">
            {MUSIC.button.label}
          </Pill>
        </div>
      </>
    ),
  };
}
