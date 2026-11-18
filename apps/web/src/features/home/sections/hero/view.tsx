import { AspirantLogo } from "@/components/logo/aspirant-logo";

import { HERO } from "../../content";
import styles from "../../home.module.css";
import { Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="hero" note="splash cards, the logo and its wave" />,
    text: (
      <div className={styles.centreBox}>
        <h1 className={styles.logoHeading}>
          <AspirantLogo />
        </h1>
        <p className={styles.cue}>{HERO.cue}</p>
      </div>
    ),
  };
}
