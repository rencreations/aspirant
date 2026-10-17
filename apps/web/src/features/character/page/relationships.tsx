import type { CSSProperties } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { TLink } from "@/components/transition/t-link";
import type { Slug } from "@/content/types";
import { asset } from "@/lib/asset";
import { characterRoute } from "@/lib/site";

import { SectionHead } from "./section-head";
import styles from "./relationships.module.css";

export interface RelationshipCard {
  readonly key: string;
  readonly name: string;
  readonly text: string;
  /** Set for one of the ten: links to her page. */
  readonly link: {
    readonly slug: Slug;
    readonly aspirantName: string;
    readonly focus: string;
    readonly colour: string;
    readonly partner: boolean;
  } | null;
}

interface RelationshipsProps {
  name: string;
  cards: readonly RelationshipCard[];
}

/**
 * The people around her. Aspirants are linked cards: hover or focus shows the relationship
 * (always shown on touch screens), click opens her page. The partner is highlighted.
 */
export function Relationships({ name, cards }: RelationshipsProps) {
  return (
    <section aria-labelledby="links-title" className={`${styles.section} shell`}>
      <SectionHead id="links-title" index="02" code="Resonance links" title="Relationships">
        The people closest to {name}, as the story tells it.
      </SectionHead>
      <ul className={styles.grid}>
        {cards.map((card, i) => {
          const descId = `rel-${card.key}`;
          if (!card.link) {
            return (
              <li key={card.key} className={styles.item} data-kind="person">
                <div className={styles.person}>
                  <span className={styles.personMark} aria-hidden="true">
                    <StarGlyph />
                  </span>
                  <span className={styles.code} aria-hidden="true">
                    Link {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className={styles.name}>{card.name}</h3>
                  <p className={styles.textStatic}>{card.text}</p>
                </div>
              </li>
            );
          }
          const l = card.link;
          return (
            <li
              key={card.key}
              className={styles.item}
              data-kind="aspirant"
              data-partner={l.partner || undefined}
              style={{ "--rc": l.colour, "--focus": l.focus } as CSSProperties}
            >
              <TLink
                href={characterRoute(l.slug)}
                transitionLabel={card.name}
                className={styles.card}
                aria-describedby={descId}
                data-cursor="OPEN"
              >
                <span className={styles.portrait} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(`/img/char/${l.slug}/splash-sm.webp`)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className={styles.cardHead}>
                  <span className={styles.code} aria-hidden="true">
                    {l.partner ? "Partner" : `Link ${String(i + 1).padStart(2, "0")}`}
                  </span>
                  <span className={styles.name}>{card.name}</span>
                  <span className={styles.aspirant}>{l.aspirantName}</span>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                  <svg viewBox="0 0 14 14">
                    <path
                      d="M1 7h11M8 3l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                  </svg>
                </span>
              </TLink>
              <p id={descId} className={styles.text}>
                {card.text}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
