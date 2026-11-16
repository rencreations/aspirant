"use client";

import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { CHARACTER_NAMES, type CharacterSlug } from "@/lib/slugs";

import { SplashArt } from "../arts/cosplay/art";
import { ROSTER_ORDER } from "../arts/cosplay/model";
import { Flag } from "./flags";
import { LANGUAGES } from "./languages";
import { voicelinesRoute } from "./model";
import styles from "./room.module.css";
import type { VoiceCharacter } from "./types";

/**
 * The roster of the ten Aspirants (the layout of the Cosplay roster: one pair to a column on a wide
 * screen, one pair to a row on a narrow one). Under the art of each there is a shortcut to every
 * language, with its flag and its name in itself, and a larger button that opens her page in
 * Japanese. The shortcuts and the button are real links, so the tiles work before the scripts run.
 */
export function Roster({ characters }: { characters: readonly VoiceCharacter[] | null }) {
  return (
    <ul className={styles.grid} data-voicelines-grid="">
      {ROSTER_ORDER.map((slug) => (
        <li key={slug}>
          <Tile slug={slug} character={characters?.find((c) => c.slug === slug) ?? null} />
        </li>
      ))}
    </ul>
  );
}

function Tile({ slug, character }: { slug: CharacterSlug; character: VoiceCharacter | null }) {
  const name = CHARACTER_NAMES[slug];
  const style = character
    ? ({ "--accent": character.palette.primary } as CSSProperties)
    : undefined;
  return (
    <article className={styles.tile} data-voicelines-tile={slug} style={style}>
      <TLink
        href={voicelinesRoute(slug)}
        transitionLabel={name}
        className={styles.tileArt}
        tabIndex={-1}
        aria-hidden="true"
      >
        <SplashArt slug={slug} alt="" className={styles.tileImg} />
      </TLink>
      <h2 className={styles.meta}>
        <span className={styles.name}>{name}</span>
        {character ? <span className={styles.digits}>{character.lines.en} lines</span> : null}
      </h2>
      <ul className={styles.langs} aria-label={`${name}, choose a language`}>
        {LANGUAGES.map((lang) => (
          <li key={lang.id}>
            <TLink
              href={voicelinesRoute(slug, { lang: lang.id })}
              transitionLabel={name}
              className={styles.lang}
              aria-label={`${name}, ${lang.english}`}
              data-lang={lang.id}
            >
              <Flag id={lang.flag} className={styles.flag} />
              <span className={styles.langName} lang={lang.html} dir={lang.dir}>
                {lang.name}
              </span>
              {character ? (
                <span className={styles.langCount}>{character.lines[lang.id]}</span>
              ) : null}
            </TLink>
          </li>
        ))}
      </ul>
      <TLink
        href={voicelinesRoute(slug)}
        transitionLabel={name}
        className={styles.open}
        aria-label={`Open voicelines, ${name}`}
        data-voicelines-open={slug}
      >
        <span>Open voicelines</span>
        <span className={styles.openHint}>
          <span lang="ja">日本語</span>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
      </TLink>
    </article>
  );
}
