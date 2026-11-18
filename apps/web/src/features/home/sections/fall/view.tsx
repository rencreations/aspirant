import { FALL } from "../../content";
import styles from "../../home.module.css";
import type { SectionMarkup } from "../../kernel/types";

import fall from "./fall.module.css";

/**
 * What the server draws for the section: the two lines of the fall as real text, "5 Phases" and
 * "10 Characters" (the number on the left of the doll, the word on the right). The doll and the air
 * marks are drawn by the canvas; the runtime moves these lines with the scroll.
 */
export function view(): SectionMarkup {
  return {
    text: (
      <>
        <h2 className={styles.srOnly}>{FALL.heading}</h2>
        <div className={fall.pairs}>
          {FALL.lines.map((line) => (
            <p key={line.right} className={fall.pair} data-fall-pair="">
              <span className={`${fall.left} ${fall.number}`} data-fall-left="">
                {line.left}
              </span>{" "}
              <span className={fall.right} data-fall-right="">
                {line.right}
              </span>
            </p>
          ))}
        </div>
      </>
    ),
  };
}
