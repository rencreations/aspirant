"use client";

import type { Route } from "next";

import { TLink } from "@/components/transition/t-link";

import { COPY, NAMES, PARTNER, type Who } from "../duo-data";
import { useReveal } from "../use-reveal";
import styles from "./switch.module.css";

/**
 * The way to the other page of the pair, drawn as a switch between night and morning. The knob
 * sits on the side of the page the visitor is on; pointing at the switch slides it toward the
 * other side, and a press turns the page over to her partner.
 */
export function Switch({ who, href }: { who: Who; href: Route }) {
  const ref = useReveal<HTMLElement>("0px");
  const copy = COPY[who];
  const other = PARTNER[who];
  return (
    <section
      ref={ref}
      className={styles.section}
      data-who={who}
      aria-label={`Go to ${NAMES[other]}`}
    >
      <TLink
        href={href}
        className={styles.link}
        transitionLabel={NAMES[other]}
        data-cursor="SWITCH"
      >
        <span className={styles.kicker}>{copy.switchLine}</span>
        <span className={styles.track} aria-hidden="true">
          <span className={styles.moon}>
            <svg viewBox="0 0 24 24" width="28" height="28">
              <path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.sun}>
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="4.2" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
            </svg>
          </span>
          <span className={styles.knob} />
        </span>
        <span className={styles.label}>{copy.switchLabel}</span>
        <span className={styles.name}>{NAMES[other]}</span>
      </TLink>
    </section>
  );
}
