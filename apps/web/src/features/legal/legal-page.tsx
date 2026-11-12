import type { ReactNode } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { LEGAL_EFFECTIVE, LEGAL_ROUTES, OPERATOR } from "@/lib/legal";
import { routes } from "@/lib/site";

import styles from "./legal-page.module.css";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

type LegalName = keyof typeof LEGAL_ROUTES;

const NAMES: Record<LegalName, string> = {
  terms: "Terms of service",
  privacy: "Privacy policy",
  takedown: "Copyright and takedown",
};

interface LegalPageProps {
  /** Which page this is, so the foot marks it. */
  current: LegalName;
  title: string;
  /** One or two sentences under the title. */
  lead: string;
  /** The short version: a few plain lines before the sections. */
  summary?: readonly ReactNode[];
  sections: readonly LegalSection[];
  /** Extra content between the short version and the sections (the takedown form). */
  children?: ReactNode;
}

/**
 * A page of plain legal text: the title, a short version, numbered sections with a list of them at
 * the side (wide screens), and a foot with the other legal pages and who to write to. Nothing
 * moves. Real HTML, so it reads before the scripts have run.
 */
export function LegalPage({ current, title, lead, summary, sections, children }: LegalPageProps) {
  return (
    <ThemeZone theme="daybreak" as="div" className={styles.page}>
      <div className={`${styles.wrap} shell below-nav`}>
        <header className={styles.head}>
          <h1 className={`${styles.title} display`}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <p className={styles.meta}>In force from {LEGAL_EFFECTIVE}</p>
        </header>

        <div className={styles.cols}>
          <nav className={styles.toc} aria-label="Sections of this page">
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className={styles.body}>
            {summary ? (
              <aside className={styles.summary} aria-label="In short">
                <h2>In short</h2>
                <ul>
                  {summary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </aside>
            ) : null}

            {children}

            {sections.map((section) => (
              <section key={section.id} id={section.id} className={styles.section}>
                <h2>{section.title}</h2>
                {section.body}
              </section>
            ))}

            <footer className={styles.foot}>
              <nav aria-label="Legal pages" className={styles.pages}>
                {(Object.keys(LEGAL_ROUTES) as LegalName[]).map((name) => (
                  <TLink
                    key={name}
                    href={LEGAL_ROUTES[name]}
                    transitionLabel={NAMES[name]}
                    aria-current={name === current ? "page" : undefined}
                  >
                    {NAMES[name]}
                  </TLink>
                ))}
                <TLink href={routes.home} transitionLabel="Home">
                  Back to the archive
                </TLink>
              </nav>
              <address className={styles.contact}>
                <strong>{OPERATOR.name}</strong>
                <span>{OPERATOR.role}</span>
                {OPERATOR.addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
                <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
              </address>
            </footer>
          </div>
        </div>
      </div>
    </ThemeZone>
  );
}
