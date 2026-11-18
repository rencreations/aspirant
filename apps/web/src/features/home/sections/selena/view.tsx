import { SELENA } from "../../content";
import homeStyles from "../../home.module.css";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";
import { SKY } from "../list/selena-frame";

import styles from "./selena.module.css";
import { starField } from "./stars";

/** The stars of the sky, one fixed pattern (the server and the client draw the same). */
const STARS = starField(46);

/**
 * What the server draws for the section. Under the canvas: the sky (the one the list ends on, so the
 * two meet without a seam), its stars, the drawer's panel and the white of the way out. Over the
 * canvas: the owner's words and the button, in the drawer. The panel is a gradient made to read as
 * frosted glass (no `backdrop-filter`, which the site never puts over a live picture): the sky's
 * lights are drawn again inside it, large and soft.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={styles.below}>
        <div className={styles.sky} data-selena-sky="" style={{ background: SKY }} />
        <svg
          className={styles.stars}
          data-selena-stars=""
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dfe6ff" opacity={s.o} />
          ))}
        </svg>
        <svg
          className={styles.star}
          data-selena-star=""
          viewBox="-50 -50 100 100"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="selena-star-glow">
              <stop offset="0" stopColor="#ff6a3c" stopOpacity="0.55" />
              <stop offset="0.45" stopColor="#c8325a" stopOpacity="0.22" />
              <stop offset="1" stopColor="#c8325a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle r="50" fill="url(#selena-star-glow)" />
          <path
            d="M0 -46 C2 -12 12 -2 46 0 C12 2 2 12 0 46 C-2 12 -12 2 -46 0 C-12 -2 -2 -12 0 -46Z"
            fill="#2a0f1c"
            stroke="#ff9a5a"
            strokeWidth="0.8"
            strokeOpacity="0.7"
          />
        </svg>
        <div className={styles.drawer} data-selena-drawer="">
          <div className={styles.glass} />
          <div className={styles.lights} />
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
