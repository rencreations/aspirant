"use client";

import type { ReactNode } from "react";

import { useReveal } from "../use-reveal";
import styles from "./head.module.css";

interface Props {
  /** "01", the number of the section on the page. */
  index: string;
  /** The small mono label above the title. */
  label: string;
  title: string;
  id: string;
  children?: ReactNode;
}

/** The head of every section: its number, label and title, with a rule that draws itself. */
export function Head({ index, label, title, id, children }: Props) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={styles.head}>
      <p className={styles.meta} data-reveal>
        <span className={styles.index}>{index}</span>
        <span className={styles.rule} aria-hidden="true" />
        <span>{label}</span>
      </p>
      <h2 id={id} className={styles.title} data-reveal>
        {title}
      </h2>
      {children ? (
        <p className={styles.lede} data-reveal>
          {children}
        </p>
      ) : null}
    </div>
  );
}
