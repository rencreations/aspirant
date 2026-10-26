"use client";

import type { Route } from "next";
import { useState, type CSSProperties } from "react";

import { NextFooter } from "@/components/next-footer/next-footer";
import { TLink } from "@/components/transition/t-link";
import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { characterRoute } from "@/lib/site";
import { CONFIG } from "./config";
import { BenchHero } from "./hero-bench";
import { ScopeHero } from "./hero-scope";
import styles from "./lc.module.css";
import { HERO, PARTNER, type Who } from "./media";
import { Films, Gallery } from "./media-sections";
import { Channel, Deck, Head, Profile, Reveal } from "./parts";
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
 * 06. Together. Both splash arts side by side with a thread of light between them. Point at the
 * link to her partner and the two halves lean in and the thread lights up.
 */
function Together({ who }: { who: Who }) {
  const other = PARTNER[who];
  const me = getCharacter(who);
  const them = getCharacter(other);
  const text =
    me.sections.relationships.find((r) => r.slug === other)?.text ??
    `${me.name} and ${them.name} are partners.`;
  const [joined, setJoined] = useState(false);
  const on = () => {
    setJoined(true);
  };
  const off = () => {
    setJoined(false);
  };
  return (
    <section
      id="together"
      className={styles.together}
      data-who={who}
      data-theme="storm"
      aria-labelledby="lc-together"
    >
      <Head no={6} label="Together" title="Lesley and Chang'e" id="lc-together" />
      <div className={styles.halves} data-joined={joined}>
        {(["lesley", "change"] as const).map((w) => (
          <figure key={w} className={styles.half} data-side={w}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(HERO[w].src)}
              alt=""
              width={HERO[w].width}
              height={HERO[w].height}
              loading="lazy"
              decoding="async"
              draggable={false}
              style={{ objectPosition: w === "lesley" ? "56% 36%" : "60% 32%" }}
            />
            <figcaption>{getCharacter(w).name}</figcaption>
          </figure>
        ))}
        <span className={styles.thread} aria-hidden="true" />
      </div>
      <div className={styles.togetherBody}>
        <Reveal className={styles.togetherText}>
          <p>{text}</p>
          <p className={styles.quote}>{me.tagline}</p>
        </Reveal>
        <Reveal className={styles.togetherLink} delay={1}>
          <TLink
            href={characterRoute(other)}
            transitionLabel={them.name}
            className={styles.partnerLink}
            data-cursor="GO"
            onPointerEnter={on}
            onPointerLeave={off}
            onFocus={on}
            onBlur={off}
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
 * One page of the pair: Lesley's or Chang'e's. Both are two ends of one channel and share the
 * order of the sections and the pill that leads to the other end. They differ in colour, type,
 * layout and in what the first screen does: Lesley's scope, Chang'e's bench.
 */
export function LcPage({ who, next }: { who: Who; next: NextCharacter }) {
  return (
    <div data-lc data-who={who} className={styles.page} style={CONFIG[who].vars}>
      {who === "lesley" ? <ScopeHero /> : <BenchHero />}
      <Channel who={who} />
      <Profile who={who} />
      <Deck who={who} />
      <Voice who={who} />
      <Films who={who} />
      <Gallery who={who} />
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
