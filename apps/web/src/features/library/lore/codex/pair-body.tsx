"use client";

import { TLink } from "@/components/transition/t-link";

import { chapterChip, chapterLink, chapterName } from "./chapters";
import { LoreLink } from "./entry-body";
import styles from "./entry-body.module.css";
import { REL_META, relLabel } from "./model";
import type { Codex } from "./use-codex";
import type { BodyProps } from "./entry-body";
import type { CodexPair } from "./types";

/**
 * The page of one relationship: the two entries, how each stands to the other, what the book says
 * about them together in the order it says it, and a few paragraphs for the pairs that matter most.
 */
export function PairBody({
  pair,
  codex,
  reach,
  onOpen,
}: BodyProps & { pair: CodexPair; codex: Codex }) {
  const a = codex.entry.get(pair.a);
  const b = codex.entry.get(pair.b);
  const ties = pair.ties.filter((t) => t.n <= reach.reach);
  const hidden = pair.ties.length - ties.length;
  // From a's side: "out" reads as it is written, "in" is turned round.
  const labels = [...new Set(ties.map((t) => relLabel(t.type, t.dir)))];
  const family = ties[0] ? REL_META[ties[0].type].family : "bond";
  const showText = hidden === 0 && pair.text.length > 0;

  return (
    <div className={styles.body}>
      <ul className={styles.pairHeads}>
        {[a, b].map((e, i) =>
          e ? (
            <li key={e.slug} className={styles.pairHead}>
              <LoreLink slug={e.slug} onOpen={onOpen} className={styles.relName}>
                {e.name}
              </LoreLink>
              <span className={styles.pairSub}>{e.sub}</span>
              <span className={styles.pairRole}>
                {ties[0]
                  ? relLabel(ties[0].type, (i === 0) === (ties[0].dir === "out") ? "out" : "in")
                  : ""}
              </span>
            </li>
          ) : null,
        )}
      </ul>

      <p className={styles.relTags}>
        {labels.map((l) => (
          <span key={l} className={styles.relTag} data-family={family}>
            {l}
          </span>
        ))}
      </p>

      {showText ? (
        <section className={styles.section} aria-label="About the two">
          {pair.text.map((para) => (
            <p key={para.slice(0, 40)} className={styles.lead}>
              {para}
            </p>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="codex-pair-story" className={styles.section}>
        <h3 id="codex-pair-story" className={styles.h}>
          What the story says of the two
        </h3>
        <ul className={styles.facts}>
          {ties.map((t, i) => (
            <li key={`${String(t.n)}-${String(t.p)}-${String(i)}`}>
              <TLink
                href={chapterLink(t.n, t.p)}
                transitionLabel={chapterName(t.n)}
                className={styles.chip}
                aria-label={`${t.t} Read it in ${chapterName(t.n)}.`}
              >
                {chapterChip(t.n)}
              </TLink>
              <span>{t.t}</span>
            </li>
          ))}
        </ul>
        {hidden > 0 ? (
          <p className={styles.shut}>
            {hidden} more {hidden === 1 ? "line comes" : "lines come"} from chapters you have not
            reached.{" "}
            <button
              type="button"
              className={styles.shutButton}
              onClick={() => {
                reach.setShield(false);
              }}
            >
              Show everything
            </button>
          </p>
        ) : null}
      </section>
    </div>
  );
}
