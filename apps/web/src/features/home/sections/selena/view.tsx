import { SELENA } from "../../content";
import homeStyles from "../../home.module.css";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import styles from "./selena.module.css";

/**
 * What the server draws for the section. Under the canvas: the drawer's panel and the white of the way
 * out, on the plain ground (no sky, no tint: the owner, 20 Nov 2026). Over the canvas: the owner's
 * words and the button, in the drawer. The panel is a pale gradient made to read as frosted glass (no
 * `backdrop-filter`, which the site never puts over a live picture).
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={styles.below}>
        <div className={styles.drawer} data-selena-drawer="">
          <div className={styles.glass} />
          <div className={styles.grain} />
          <i className={styles.edge} />
        </div>
        <div className={styles.white} data-selena-white="" />
      </div>
    ),
    text: (
      <>
        <div className={styles.front} data-selena-front="" aria-hidden="true" />
        <div className={styles.copy} data-selena-copy="">
          <h2
            className={`${homeStyles.title} ${homeStyles.titleSmall} ${styles.title}`}
            data-selena-title=""
          >
            {SELENA.title}
          </h2>
          <p className={`${homeStyles.lead} ${styles.body}`} data-selena-body="">
            {SELENA.body}
          </p>
          <div className={`${homeStyles.actions} ${styles.action}`} data-selena-action="">
            <Pill href={SELENA.button.href} label="Animation">
              {SELENA.button.label}
            </Pill>
          </div>
        </div>
      </>
    ),
  };
}
