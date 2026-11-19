import { TLink } from "@/components/transition/t-link";
import { NOTICE } from "@/features/about/content";
import { ReportLink } from "@/features/legal/takedown/report-link";
import { LEGAL_ROUTES } from "@/lib/legal";

import { FooterAction } from "../../footer-action";
import { FOOTER } from "../../content";
import type { SectionMarkup } from "../../kernel/types";

import { CookieButton } from "./cookie-button";
import { ExitHook } from "./exit-hook";
import styles from "./footer.module.css";

/**
 * What the server draws for the footer, which lives in the page's own flow (the last section): a
 * card of hairlines, with a ring in its middle where the drone rests, the owner's line and a hairline
 * under it that fills as the end of the page comes (it is full at the point where About opens, so the
 * cue is honest on a page with no scrollbar), the way on (a real button, and the N key), and the
 * foot every page of the site carries: who made it, Terms, Privacy, Cookie settings, the takedown
 * shortcut and the fan-project notice. The card has no fill: the drone is drawn under the page's
 * text layer, so the ground shows through and the ring is where it stands.
 */
export function view(): SectionMarkup {
  const legal = FOOTER.legal;
  return {
    text: (
      <div className={styles.card} data-footer-card="">
        <ExitHook />
        <p className={styles.eyebrow}>{FOOTER.eyebrow}</p>
        <div className={styles.centre}>
          <div className={styles.ring} data-footer-ring="" aria-hidden="true" />
          <h2 className={styles.title}>{FOOTER.title}</h2>
          <p className={styles.line}>{FOOTER.line}</p>
          <span className={styles.rule} aria-hidden="true">
            <span className={styles.fill} data-footer-fill="" />
          </span>
          <FooterAction actionsClassName={styles.actions} hintClassName={styles.hint} />
        </div>
        <div className={styles.foot}>
          <p className={styles.madeBy}>{legal.madeBy}</p>
          <nav aria-label={legal.label} className={styles.legal}>
            <TLink
              href={LEGAL_ROUTES.terms}
              className={styles.legalLink}
              transitionLabel={legal.terms}
            >
              {legal.terms}
            </TLink>
            <TLink
              href={LEGAL_ROUTES.privacy}
              className={styles.legalLink}
              transitionLabel={legal.privacy}
            >
              {legal.privacy}
            </TLink>
            <CookieButton className={styles.legalLink}>{legal.cookies}</CookieButton>
            <ReportLink className={styles.legalLink} item={{ title: legal.takedownItem }} />
          </nav>
          <p className={styles.notice}>{NOTICE}</p>
        </div>
      </div>
    ),
  };
}
