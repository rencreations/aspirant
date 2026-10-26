"use client";

import type { Route } from "next";
import { useState, type CSSProperties } from "react";

import { NextFooter } from "@/components/next-footer/next-footer";
import { TLink } from "@/components/transition/t-link";
import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { characterRoute } from "@/lib/site";
import { CONFIG } from "./config";
import { Hero } from "./hero";
import styles from "./lf.module.css";
import { PAIR_SPLASH, PARTNER, type Who } from "./media";
import { Films, Gallery, Music, type Fan } from "./media-sections";
import { Head, Notes, Profile, Rail, Reveal } from "./parts";
import { Voice } from "./voice";

/** What the page needs to say about the next character (the footer at the very end). */
export interface NextCharacter {
  slug: string;
  name: string;
  aspirantName: string;
  tagline: string;
  order: number;
  href: Route;
  /** Public path of the splash art, for the footer. */
  image: string;
  /** Her accent colour, readable on the page. */
  accent: string;
  /** Her palette as page tokens, for the footer. */
  vars: CSSProperties;
}

/**
 * 07. Together. Layla's beam comes in from the left and Fanny's cable from the right. They meet at
 * a node under the official art. Press or hover the link to her partner and they join.
 */
function Together({ who }: { who: Who }) {
  const other = PARTNER[who];
  const me = getCharacter(who);
  const them = getCharacter(other);
  const text =
    me.sections.relationships.find((r) => r.slug === other)?.text ??
    `${me.name} and ${them.name} are partners.`;
  const [joined, setJoined] = useState(false);
  return (
    <section
      id="together"
      className={styles.together}
      data-who={who}
      data-theme="storm"
      aria-labelledby="lf-together"
    >
      <div className={styles.togetherArt} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(PAIR_SPLASH)}
          alt=""
          width={2048}
          height={1152}
          loading="lazy"
          draggable={false}
        />
      </div>
      <Head no={7} label="Together" title={`${me.name} and ${them.name}`} id="lf-together" />
      <div className={styles.togetherBody}>
        <Reveal className={styles.togetherText}>
          <p>{text}</p>
          <p className={styles.coupling}>
            <span>Coupling</span>
            <i aria-hidden="true">
              <b />
            </i>
            <em>The highest the Academy has measured</em>
          </p>
        </Reveal>
        <div className={styles.join} data-joined={joined} aria-hidden="true">
          <span className={styles.joinLeft} />
          <span className={styles.joinNode} />
          <span className={styles.joinRight} />
        </div>
        <Reveal className={styles.togetherLink} delay={1}>
          <TLink
            href={characterRoute(other)}
            transitionLabel={them.name}
            className={styles.partnerLink}
            data-cursor="GO"
            onPointerEnter={() => {
              setJoined(true);
            }}
            onPointerLeave={() => {
              setJoined(false);
            }}
            onFocus={() => {
              setJoined(true);
            }}
            onBlur={() => {
              setJoined(false);
            }}
          >
            <span>Meet {them.name}</span>
            <small>{them.aspirantName}</small>
          </TLink>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * One page of the pair: Layla's or Fanny's. Both share the line (the rail down the side, the beam
 * and the cable that meet at the end) and the order of the sections, and differ in colour, type,
 * layout and in what the first screen does.
 */
export function LfPage({
  who,
  next,
  fanart,
}: {
  who: Who;
  next: NextCharacter;
  fanart: readonly Fan[];
}) {
  return (
    <div data-lf data-who={who} className={styles.page} style={CONFIG[who].vars}>
      <Rail who={who} />
      <Hero who={who} />
      <Profile who={who} />
      <Notes who={who} />
      <Voice who={who} />
      <Films who={who} />
      <Gallery who={who} fanart={fanart} />
      <Music who={who} />
      <Together who={who} />
      <div data-theme="daybreak" className={styles.nextZone} style={next.vars}>
        <NextFooter
          eyebrow="Next in queue"
          label={next.name}
          sublabel={`${next.aspirantName}. Unit ${String(next.order).padStart(2, "0")} of 10. ${next.tagline}`}
          href={next.href}
          image={next.image}
          accent={next.accent}
        />
      </div>
    </div>
  );
}
