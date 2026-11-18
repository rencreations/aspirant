import { FooterAction } from "../../footer-action";
import { FOOTER } from "../../content";
import styles from "../../home.module.css";
import { Stub } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

/** What the server draws for the section: real copy and real links, from `content.ts`. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="footer" note="the footer and the way to About" />,
    text: (
      <div className={styles.centreBox}>
        <p className={styles.eyebrow}>{FOOTER.eyebrow}</p>
        <h2 className={styles.title}>{FOOTER.title}</h2>
        <p className={styles.lead}>{FOOTER.line}</p>
        <FooterAction />
      </div>
    ),
  };
}
