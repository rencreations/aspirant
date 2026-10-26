"use client";

import { Spoilers, type SpoilerFact } from "../../page/spoilers";
import type { Who } from "../duo-data";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./log.module.css";

export interface LogEntry {
  key: string;
  label: string;
  lines: readonly string[];
}

interface Props {
  who: Who;
  name: string;
  label: string;
  entries: readonly LogEntry[];
  background: readonly string[];
  later: readonly SpoilerFact[];
}

function Entry({ who, entry, n }: { who: Who; entry: LogEntry; n: number }) {
  const ref = useReveal<HTMLElement>("0px");
  return (
    <article ref={ref} className={styles.entry} data-who={who}>
      <header className={styles.entryHead}>
        <span className={styles.num}>{String(n).padStart(2, "0")}</span>
        <h3 className={styles.entryTitle}>{entry.label}</h3>
      </header>
      <ul className={styles.lines}>
        {entry.lines.map((line, i) => (
          <li key={i} style={{ transitionDelay: `${120 + i * 90}ms` }}>
            {line}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Who she is, as a log: Ruby's reads like a change log (a ruled list, in mono, each entry a block
 * of changes), Angela's like a diary (soft pages that sit a little crooked). The story so far and
 * what happens later stay sealed in the record underneath until the visitor opens them.
 */
export function Log({ who, name, label, entries, background, later }: Props) {
  return (
    <section className={styles.section} data-who={who} aria-labelledby={`${who}-log`}>
      <Head
        id={`${who}-log`}
        index="02"
        label={label}
        title={who === "ruby" ? "What changed" : "Dear Tetra"}
      >
        {who === "ruby"
          ? `${name} in short entries. Each one is a thing that holds.`
          : `${name} writes down what she has learned so far.`}
      </Head>
      <div className={styles.list}>
        {entries.map((entry, i) => (
          <Entry key={entry.key} who={who} entry={entry} n={i + 1} />
        ))}
      </div>
      <div className={styles.seal}>
        <Spoilers name={name} background={background} later={later} />
      </div>
    </section>
  );
}
