"use client";

import type { CSSProperties, ReactNode } from "react";

import { SECTION_ORDER } from "./filters";
import styles from "./sections.module.css";
import type { OthersGroup } from "./types";
import { useSeen } from "./use-in-view";

interface SectionProps {
  group: OthersGroup;
  count: number;
  /** A short extra line under the lead, for example the figure for the whole group. */
  children: ReactNode;
  /** The reveal this section plays when it comes on screen. */
  reveal: "stage" | "pop" | "rise" | "scale" | "slide" | "fade";
}

/** One section of the page: its number, a big title, a lead line, and a reveal of its own. */
export function Section({ group, count, children, reveal }: SectionProps) {
  const [ref, seen] = useSeen<HTMLElement>();
  const no = String(SECTION_ORDER.indexOf(group.id) + 1).padStart(2, "0");
  return (
    <section
      ref={ref}
      id={`sec-${group.id}`}
      className={styles.section}
      data-reveal={reveal}
      data-seen={seen}
      data-long={group.title.length > 20}
      aria-labelledby={`h-${group.id}`}
      style={{ "--count": count } as CSSProperties}
    >
      <header className={styles.head}>
        <p className={`${styles.no} hud-label`}>
          {no} / {count} {count === 1 ? "item" : "items"}
        </p>
        <h2 id={`h-${group.id}`} className={`${styles.title} display`}>
          {group.title}
        </h2>
        <p className={styles.lead}>{group.line}</p>
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
