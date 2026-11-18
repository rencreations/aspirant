import { FALL } from "../../content";
import styles from "../../home.module.css";
import { Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="fall" note="the doll falls: 5 Phases, 10 Characters" />,
    text: (
      <>
        <h2 className={styles.srOnly}>{FALL.heading}</h2>
        {FALL.lines.map((line) => (
          <p key={line.right} className={styles.counter}>
            <span className={styles.counterNumber}>{line.left}</span> {line.right}
          </p>
        ))}
      </>
    ),
  };
}
