import { BOLT } from "../../content";
import styles from "../../home.module.css";
import type { SectionMarkup } from "../../kernel/types";

import bolt from "./bolt.module.css";

/**
 * What the server draws for the section: the five pairs as a real list. In the stage the list is the
 * text wheel (the runtime turns it, one name in focus at a time, one pair for each play); without the
 * stage it is a plain list of names. The green of the section is the live backdrop, drawn by the stage.
 */
export function view(): SectionMarkup {
  return {
    text: (
      <>
        <h2 className={styles.srOnly}>{BOLT.heading}</h2>
        <ul className={`${styles.list} ${bolt.wheel}`}>
          {BOLT.pairs.map((pair) => (
            <li key={pair} className={bolt.item} data-bolt-item="">
              <span className={bolt.name}>{pair}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  };
}
