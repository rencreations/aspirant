"use client";

import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";

import { crop } from "../crop";
import { FACE, type Who } from "../duo-data";
import { splashPath } from "../duo-media";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./spec.module.css";

export interface SpecProps {
  who: Who;
  name: string;
  aspirantName: string;
  jp: { script: string; romaji: string | null };
  ageText: string;
  birthday: string;
  mbti: string;
  role: string;
  weapon: string;
  partnerName: string;
  summary: string;
}

/**
 * The file on her: a round portrait cut from the art with a ring that turns slowly, the summary,
 * and every fact on one sheet. Ruby's is a bench sheet (ruled, in mono); Angela's is a unit card
 * (rounded, in soft cards).
 */
export function Spec(p: SpecProps) {
  const ref = useReveal<HTMLElement>();
  const rows: ReadonlyArray<[string, string]> = [
    ["Aspirant name", p.aspirantName],
    ["Japanese", p.jp.romaji ? `${p.jp.script} (${p.jp.romaji})` : p.jp.script],
    ["Age", p.ageText],
    ["Birthday", p.birthday],
    ["Type", p.mbti],
    ["Role", p.role],
    ["Weapon", p.weapon],
    ["Partner", p.partnerName],
  ];
  return (
    <section
      ref={ref}
      className={styles.section}
      data-who={p.who}
      aria-labelledby={`${p.who}-spec`}
    >
      <Head
        id={`${p.who}-spec`}
        index="01"
        label={p.who === "ruby" ? "Bench sheet" : "Unit card"}
        title={p.who === "ruby" ? "The file" : "Who she is"}
      >
        {p.summary}
      </Head>
      <div className={styles.grid}>
        <div className={styles.portrait} data-reveal aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.ring2} />
          <span
            className={styles.face}
            style={crop(asset(splashPath(p.who)), FACE[p.who], FACE[p.who].zoom)}
          />
          <span className={styles.tag}>{p.name}</span>
        </div>
        <dl className={styles.table}>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              className={styles.row}
              data-reveal
              style={{ "--d": `${i * 60}ms` } as CSSProperties}
            >
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
