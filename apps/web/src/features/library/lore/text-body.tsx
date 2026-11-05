"use client";

import { Fragment, type ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { characterRoute } from "@/lib/site";
import { isCharacterSlug } from "@/lib/slugs";

import { highlight } from "./search";
import styles from "./text-body.module.css";
import type { Block } from "./types";

/** A line of text with the search words marked. */
export function Hl({ text, terms }: { text: string; terms: readonly string[] }): ReactNode {
  if (terms.length === 0) return text;
  return highlight(text, terms).map((p, i) =>
    p.hit ? (
      <mark key={i} className={styles.mark}>
        {p.text}
      </mark>
    ) : (
      <Fragment key={i}>{p.text}</Fragment>
    ),
  );
}

function relKind(rel: string): string {
  const r = rel.toLowerCase();
  if (r.includes("hostile")) return "hostile";
  if (r.includes("friend") || r.includes("confidant") || r.includes("sister")) return "close";
  if (r.includes("teacher") || r.includes("student") || r.includes("healer") || r.includes("maker"))
    return "bond";
  if (r.includes("distrust") || r.includes("dominator") || r === "???") return "unsure";
  return "plain";
}

/** The blocks of one text: headings with anchors, paragraphs, quotes, lists, cards, tables. */
export function TextBody({
  blocks,
  terms = [],
}: {
  blocks: readonly Block[];
  terms?: readonly string[];
}) {
  return (
    <div className={styles.body}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": {
            const Tag = b.l === 2 ? "h2" : b.l === 3 ? "h3" : "h4";
            return (
              <Tag
                key={i}
                id={b.id}
                className={`${styles.h} ${styles[`h${b.l}`]}`}
                data-heading={b.id}
              >
                <a href={`#${b.id}`} className={styles.anchor} aria-label={`Link to ${b.x}`}>
                  #
                </a>
                <Hl text={b.x} terms={terms} />
              </Tag>
            );
          }
          case "p":
            return (
              <p key={i} className={styles.p}>
                <Hl text={b.x} terms={terms} />
              </p>
            );
          case "q":
            return (
              <blockquote key={i} className={styles.quote}>
                <Hl text={b.x} terms={terms} />
              </blockquote>
            );
          case "sub":
            return (
              <p key={i} className={`${styles.sub} serif`}>
                <Hl text={b.x} terms={terms} />
              </p>
            );
          case "note":
            return (
              <p key={i} className={`${styles.note} hud-label`}>
                <Hl text={b.x} terms={terms} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className={styles.list}>
                {b.i.map((t, j) => (
                  <li key={j}>
                    <Hl text={t} terms={terms} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className={`${styles.list} ${styles.steps}`}>
                {b.i.map((t, j) => (
                  <li key={j}>
                    <Hl text={t} terms={terms} />
                  </li>
                ))}
              </ol>
            );
          case "kv":
            return (
              <dl key={i} className={styles.kv}>
                {b.rows.map(([k, v], j) => (
                  <div key={j} className={styles.kvRow}>
                    <dt className="hud-label">
                      <Hl text={k} terms={terms} />
                    </dt>
                    <dd>
                      <Hl text={v} terms={terms} />
                    </dd>
                  </div>
                ))}
              </dl>
            );
          case "tb":
            return (
              <div key={i} className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col">
                          <Hl text={h} terms={terms} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) =>
                          k === 0 ? (
                            <th key={k} scope="row">
                              <Hl text={c} terms={terms} />
                            </th>
                          ) : (
                            <td key={k}>
                              <Hl text={c} terms={terms} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className={styles.rule} />;
          case "rel":
            return (
              <div key={i} className={styles.rel}>
                <p className="hud-label">{b.x}</p>
                <ul>
                  {b.rows.map((r, j) => (
                    <li key={j} data-kind={relKind(r.r)}>
                      {r.s && isCharacterSlug(r.s) ? (
                        <TLink
                          href={characterRoute(r.s)}
                          transitionLabel={r.w}
                          className={styles.who}
                        >
                          <Hl text={r.w} terms={terms} />
                        </TLink>
                      ) : (
                        <span className={styles.who}>
                          <Hl text={r.w} terms={terms} />
                        </span>
                      )}
                      <span className={styles.relation}>
                        <Hl text={r.r} terms={terms} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          case "chart":
            return (
              <ul key={i} className={styles.chart}>
                {b.rows.map((r, j) => (
                  <li key={j} className={styles.edge}>
                    <span className={styles.node}>
                      <Hl text={r.a} terms={terms} />
                    </span>
                    <span className={styles.link} data-both={r.both ? "1" : "0"}>
                      <em>
                        <Hl text={r.l} terms={terms} />
                      </em>
                    </span>
                    <span className={styles.node}>
                      <Hl text={r.b} terms={terms} />
                    </span>
                  </li>
                ))}
              </ul>
            );
        }
      })}
    </div>
  );
}
