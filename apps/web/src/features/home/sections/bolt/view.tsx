import { BOLT } from "../../content";
import styles from "../../home.module.css";
import { Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="bolt" note="Silverbolt, the doll and the five pairs" />,
    text: (
      <>
        <h2 className={styles.srOnly}>{BOLT.heading}</h2>
        <ul className={styles.list}>
          {BOLT.pairs.map((pair) => (
            <li key={pair}>
              <span className={styles.pairName}>{pair}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  };
}
