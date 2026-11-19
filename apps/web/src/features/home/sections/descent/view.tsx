import type { SectionMarkup } from "../../kernel/types";

import { STREAKS } from "./streaks";
import styles from "./descent.module.css";

/**
 * The descent has no words. Its `below` layer holds the wind: thin streaks and dots that rush up the
 * screen faster than the page scrolls, so the pair look like they are flying down. Decorative, so
 * `aria-hidden`; the runtime writes their transform and opacity from the scroll.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={styles.wind} data-descent-wind aria-hidden="true">
        {STREAKS.map((s, i) => (
          <i
            key={i}
            className={styles[s.kind]}
            data-descent-streak={i}
            style={{
              left: `${s.x}%`,
              width: s.kind === "streak" ? "2px" : `${s.size}px`,
              height: s.kind === "cloud" ? `${Math.round(s.size * 0.42)}px` : `${s.size}px`,
            }}
          />
        ))}
      </div>
    ),
    text: null,
  };
}
