import { BOLT } from "../../content";
import styles from "../../home.module.css";
import type { SectionMarkup } from "../../kernel/types";

import bolt from "./bolt.module.css";

/**
 * What the server draws for the section: the bloom of the ground under the canvas, and the five pairs
 * as a real list. In the stage the list is the text wheel (the runtime turns it with the scroll, one
 * name in focus at a time); without the stage it is a plain list of names.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={bolt.bloom} aria-hidden="true">
        <div className={bolt.tint} data-bolt-tint="" />
        <div className={bolt.band} data-bolt-band="" />
        <div className={bolt.glow} data-bolt-glow="">
          <div className={bolt.glowInner} />
        </div>
      </div>
    ),
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
