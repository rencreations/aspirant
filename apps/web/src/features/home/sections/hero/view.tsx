import { AspirantLogo } from "@/components/logo/aspirant-logo";

import { HERO } from "../../content";
import styles from "../../home.module.css";
import type { SectionMarkup } from "../../kernel/types";

import heroStyles from "./hero.module.css";

/**
 * What the server draws for the section: the page's one h1 (the logo) and the cue, from
 * `content.ts`. On the stage the canvas draws the logo and the cards, and the h1's own picture is
 * hidden by the runtime (it stays in the page for the screen reader and is the plain page's logo);
 * the plain page (no WebGL) shows it as it is.
 */
export function view(): SectionMarkup {
  return {
    text: (
      <div className={styles.centreBox}>
        <h1 className={styles.logoHeading} data-home-dom-logo="">
          <AspirantLogo />
        </h1>
        <div className={heroStyles.cue} data-home-cue="">
          <div className={heroStyles.cueIn}>
            <p className={heroStyles.cueLabel}>{HERO.cue}</p>
            <span className={heroStyles.cueLine} aria-hidden="true" />
          </div>
        </div>
      </div>
    ),
  };
}
