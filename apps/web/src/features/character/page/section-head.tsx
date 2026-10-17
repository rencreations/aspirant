import type { ReactNode } from "react";

import { StarGlyph } from "@/components/star-glyph";

import styles from "./section-head.module.css";

interface SectionHeadProps {
  /** Id of the h2, for the section's aria-labelledby. */
  id: string;
  /** Two-digit section number. */
  index: string;
  /** Mono code on the right, for example "Personnel file". */
  code: string;
  title: string;
  /** An optional lead paragraph. */
  children?: ReactNode;
}

/** The heading row every section of a character page opens with. */
export function SectionHead({ id, index, code, title, children }: SectionHeadProps) {
  return (
    <header className={styles.head}>
      <p className={`${styles.code} hud-label`}>
        <StarGlyph className={styles.star} />
        <span>{index}</span>
        <span className={styles.rule} aria-hidden="true" />
        <span>{code}</span>
      </p>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {children && <p className={styles.lead}>{children}</p>}
    </header>
  );
}
