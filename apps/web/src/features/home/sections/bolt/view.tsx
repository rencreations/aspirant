import { BOLT } from "../../content";
import styles from "../../home.module.css";
import type { SectionMarkup } from "../../kernel/types";

import bolt from "./bolt.module.css";

/**
 * What the server draws for the section: the five pairs as a real list (and the white that rises from
 * the bottom, decorative, in the layer under the canvas). In the stage the list is the text wheel (the
 * runtime turns it with the scroll, one name in focus and one before and after); without the stage it
 * is a plain list of names. Every name is drawn twice, a white copy and an ink copy, and the runtime
 * cross-fades them by opacity as the white rises under the wheel (a colour is never animated).
 */
export function view(): SectionMarkup {
  return {
    below: <div className={bolt.white} data-bolt-white="bolt" />,
    text: (
      <>
        <h2 className={styles.srOnly}>{BOLT.heading}</h2>
        <ul className={`${styles.list} ${bolt.wheel}`}>
          {BOLT.pairs.map((pair) => (
            <li key={pair} className={bolt.item} data-bolt-item="">
              <span className={`${bolt.name} ${bolt.light}`} data-bolt-light="">
                {pair}
              </span>
              <span className={`${bolt.name} ${bolt.ink}`} data-bolt-ink="" aria-hidden="true">
                {pair}
              </span>
            </li>
          ))}
        </ul>
      </>
    ),
  };
}
