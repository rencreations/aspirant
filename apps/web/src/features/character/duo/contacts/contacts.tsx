"use client";

import type { Route } from "next";
import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import type { Who } from "../duo-data";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./contacts.module.css";

export interface Contact {
  key: string;
  name: string;
  text: string;
  link: {
    href: Route;
    slug: string;
    aspirantName: string;
    focus: string;
    partner: boolean;
  } | null;
}

export interface ChapterLink {
  id: string;
  href: Route;
  number: string;
  title: string;
  part: string;
}

interface Props {
  who: Who;
  name: string;
  contacts: readonly Contact[];
  chapters: readonly ChapterLink[];
}

/**
 * The people around her, as contacts, and the chapters she is in. The partner leads and is the
 * largest card. Every other Aspirant links to their page.
 */
export function Contacts({ who, name, contacts, chapters }: Props) {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className={styles.section} data-who={who} aria-labelledby={`${who}-people`}>
      <Head
        id={`${who}-people`}
        index="06"
        label="Contacts"
        title={who === "ruby" ? "Who she keeps" : "Her people"}
      >
        {`The people ${name} is closest to, and where to find ${name} in the story.`}
      </Head>
      <ul className={styles.cards}>
        {contacts.map((c, i) => {
          const inner = (
            <>
              {c.link ? (
                <span className={styles.pic} aria-hidden="true">
                  {/* Plain <img>: static export. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(`/img/char/${c.link.slug}/splash-sm.webp`)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    style={{ objectPosition: c.link.focus, transformOrigin: c.link.focus }}
                  />
                </span>
              ) : (
                <span className={styles.pic} data-blank aria-hidden="true">
                  {c.name.slice(0, 1)}
                </span>
              )}
              <span className={styles.body}>
                <span className={styles.kicker}>
                  {c.link ? (c.link.partner ? "Partner" : c.link.aspirantName) : "Not an Aspirant"}
                </span>
                <span className={styles.who}>{c.name}</span>
                <span className={styles.text}>{c.text}</span>
                {c.link ? <span className={styles.go}>Open her page</span> : null}
              </span>
            </>
          );
          const delay = { "--d": `${i * 70}ms` } as CSSProperties;
          return (
            <li
              key={c.key}
              className={styles.card}
              data-partner={c.link?.partner ?? false}
              data-reveal
              style={delay}
            >
              {c.link ? (
                <TLink href={c.link.href} className={styles.inner} transitionLabel={c.name}>
                  {inner}
                </TLink>
              ) : (
                <div className={styles.inner}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      {chapters.length > 0 ? (
        <div className={styles.chapters} data-reveal>
          <h3 className={styles.chaptersTitle}>{`${name} in the story`}</h3>
          <ul className={styles.chips}>
            {chapters.map((ch) => (
              <li key={ch.id}>
                <TLink href={ch.href} className={styles.chip} transitionLabel="The story">
                  <span className={styles.chipNum}>{ch.number}</span>
                  <span>{ch.title}</span>
                </TLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
