"use client";

import Link from "next/link";
import type { Route } from "next";
import type { MouseEvent } from "react";

import { BackToCollection } from "@/features/library/shell/room-chrome";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { CHARACTER_NAMES, type CharacterSlug } from "@/lib/slugs";

import { ORDER } from "./characters";
import { describeClips, pairOf, two } from "./copy";
import styles from "./shell.module.css";
import { splashFor } from "./splash";
import type { AnimChar, AnimClip } from "./types";

interface Props {
  chars: ReadonlyMap<CharacterSlug, AnimChar>;
  clips: readonly AnimClip[];
  /** The panel the ring stands on, or is turning to. */
  target: number;
  onStep: (dir: 1 | -1) => void;
  onGo: (index: number) => void;
  onLaunch: (e: MouseEvent<HTMLAnchorElement>) => void;
}

/** Where a removal is asked for (the same address as every room of the collection). */
const TAKEDOWN_URL = "https://github.com/rencreations/aspirant/issues";

/** The full screen route of a character. */
export const fullHref = (slug: CharacterSlug) => `/collection/animation/${slug}` as Route;

/**
 * Everything over the ring, as the reference lays it out: the way back to the collection at the top
 * left, the title block over the lower left of the panel with its Launch button, two round buttons
 * on the right, and a row of the ten at the lower right (their splash art, on the face). Nothing
 * here moves the ring by itself.
 */
export function CarouselUi({ chars, clips, target, onStep, onGo, onLaunch }: Props) {
  const slug = ORDER[target]!;
  const char = chars.get(slug);
  const name = char?.name ?? CHARACTER_NAMES[slug];
  const pair = pairOf(slug);
  const own = clips.filter((c) => c.chars[0] === slug);

  return (
    <div className={styles.ringUi}>
      <BackToCollection tone="light" className={styles.backTop} />

      <section className={styles.block}>
        <p key={`k-${slug}`} className={`${styles.kicker} ${styles.enter}`}>
          <span className={styles.count}>
            {two(target + 1)} / {two(ORDER.length)}
          </span>
          {pair ? (
            <span className={styles.chip}>
              {CHARACTER_NAMES[pair[0]]} and {CHARACTER_NAMES[pair[1]]}
            </span>
          ) : null}
        </p>
        <h2 key={`t-${slug}`} className={`${styles.title} ${styles.enter} display`}>
          {name}
        </h2>
        <p key={`l-${slug}`} className={`${styles.line} ${styles.enter}`}>
          In-game showcase. {describeClips(own)}
        </p>
        <Link
          href={fullHref(slug)}
          className={styles.launch}
          onClick={onLaunch}
          onPointerEnter={() => {
            audio.blip("hover");
          }}
          aria-label={`Launch ${name} full screen`}
        >
          <span>Launch</span>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 13 13 3M6 3h7v7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Link>
      </section>

      <div className={styles.side}>
        <button
          type="button"
          className={styles.round}
          aria-label="Next character"
          onClick={() => {
            audio.blip("click");
            onStep(1);
          }}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M5 2.5v11L13 8z" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.round}
          aria-label="Character before"
          onClick={() => {
            audio.blip("click");
            onStep(-1);
          }}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M11 2.5v11L3 8z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div className={styles.foot}>
        <nav className={styles.thumbs} aria-label="Characters">
          {ORDER.map((s, i) => {
            const splash = splashFor(s);
            return (
              <button
                key={s}
                type="button"
                className={styles.thumb}
                aria-current={i === target ? "true" : undefined}
                aria-label={chars.get(s)?.name ?? CHARACTER_NAMES[s]}
                onClick={() => {
                  audio.blip("click");
                  onGo(i);
                }}
                style={{
                  ["--focus" as string]: `${splash.focus.x * 100}% ${splash.focus.y * 100}%`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(splash.src)} alt="" draggable={false} decoding="async" />
              </button>
            );
          })}
        </nav>
        <p className={styles.note}>
          In-game animation by Moonton, in a fan archive. To ask for a takedown, open an issue on{" "}
          <a href={TAKEDOWN_URL} target="_blank" rel="noopener noreferrer">
            the project page
          </a>
          .
        </p>
      </div>
    </div>
  );
}
