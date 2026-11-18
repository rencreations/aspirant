import { HAND } from "../../content";
import styles from "../../home.module.css";
import { Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="hand" note="Selena's hand and the doll" />,
    text: (
      <>
        <h2 className={styles.title + " " + styles.titleSmall}>{HAND.title}</h2>
        <p className={styles.lead}>{HAND.body}</p>
        <p className={styles.hint}>{HAND.hint}</p>
      </>
    ),
  };
}
