import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { collectionRoute } from "@/lib/site";

import { VOICES, VOICES_UI } from "../../content";
import type { SectionMarkup } from "../../kernel/types";

import {
  APPROVED_POSITION,
  PORTRAITS,
  VOICE_CHARACTERS,
  VOICE_LANGUAGES,
  splitDirections,
  type VoiceCharacter,
} from "./data";
import styles from "./voices.module.css";

function artStyle(c: VoiceCharacter): CSSProperties {
  if (APPROVED_POSITION[c.slug]) {
    return { "--tone": c.palette.primary, "--pos": APPROVED_POSITION[c.slug] } as CSSProperties;
  }
  const [x, y, previous, shift, full, thumbnail] = PORTRAITS[c.slug] ?? [0.5, 0.33, 0.5, 0, 1, 1];
  return {
    "--tone": c.palette.primary,
    "--eye-x": x,
    "--eye-y": y,
    "--previous": previous,
    "--shift": `${100 * shift}cqw`,
    "--portrait-zoom": full,
    "--thumbnail-zoom": thumbnail,
  } as CSSProperties;
}

function Panel({ character: c, active }: { character: VoiceCharacter; active: boolean }) {
  return (
    <section
      className={styles.panel}
      id={`voices-panel-${c.slug}`}
      aria-labelledby={`voices-name-${c.slug}`}
      data-voices-panel={c.slug}
      data-active={active ? "1" : "0"}
    >
      <div className={styles.nameRow}>
        <h3 className={styles.name} id={`voices-name-${c.slug}`}>
          {c.name}
        </h3>
        <span className={styles.dock} data-voices-dock="" aria-hidden="true" />
      </div>
      <div className={styles.captions} aria-live="polite" aria-atomic="true">
        {VOICE_LANGUAGES.map((language, index) => {
          const line = c.lines[language.id];
          if (!line) return null;
          return (
            <div
              key={language.id}
              data-voices-caption={language.id}
              data-active={index === 0 ? "1" : "0"}
            >
              <b className={styles.plainOnly} lang={language.html} dir={language.dir}>
                {language.native}
              </b>
              <blockquote className={styles.quote} lang={line.lang} dir={line.dir}>
                {splitDirections(line.t).map((part, i) =>
                  part.direction ? <em key={i}>{part.text}</em> : part.text,
                )}
              </blockquote>
              {language.id === "jp" && line.tr && (
                <p className={styles.translation} lang="en">
                  {line.tr}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <ul className={styles.languages} aria-label={`${c.name} voice languages`}>
        {VOICE_LANGUAGES.map((language, index) => {
          const line = c.lines[language.id];
          if (!line) return null;
          return (
            <li
              key={language.id}
              data-voices-line={language.id}
              data-key={line.key}
              data-gain={line.g}
              data-seconds={line.d}
              data-state="idle"
              data-selected={index === 0 ? "1" : "0"}
            >
              <button
                type="button"
                className={styles.play}
                data-voices-play=""
                aria-pressed="false"
                aria-label={`${VOICES_UI.play} ${c.name}, ${language.english}`}
              >
                <span className={styles.symbol} aria-hidden="true" />
                <span lang={language.html} dir={language.dir}>
                  {language.native}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.plainOnly}>
        <TLink href={collectionRoute(`voicelines/${c.slug}`)} transitionLabel={c.name}>
          {VOICES_UI.herLines}
        </TLink>
      </p>
    </section>
  );
}

export function view(): SectionMarkup {
  return {
    below: (
      <div className={styles.art} data-voices-art="" aria-hidden="true">
        <div className={styles.artFrame}>
          {VOICE_CHARACTERS.map((c) => (
            <div
              key={c.slug}
              className={styles.fig}
              data-voices-fig={c.slug}
              data-original-crop={APPROVED_POSITION[c.slug] ? "" : undefined}
              data-active={c.slug === VOICES.defaultCharacter ? "1" : "0"}
              style={artStyle(c)}
            />
          ))}
        </div>
      </div>
    ),
    text: (
      <div className={styles.voices} data-voices="">
        <header className={styles.header} data-voices-part="header">
          <h2 className={styles.title}>{VOICES.title}</h2>
          <button
            type="button"
            className={styles.choose}
            data-voices-open=""
            aria-haspopup="dialog"
            aria-controls="home-voices-picker"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M2 2h4v4H2zM10 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4z" />
            </svg>
            {VOICES_UI.chooser}
          </button>
        </header>
        <div className={styles.listening} data-voices-part="listening">
          {VOICE_CHARACTERS.map((c) => (
            <Panel key={c.slug} character={c} active={c.slug === VOICES.defaultCharacter} />
          ))}
          <div className={styles.archive}>
            <TLink href={VOICES.button.href} transitionLabel={VOICES.title}>
              {VOICES.button.label}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M3 8h10m-4-4 4 4-4 4" />
              </svg>
            </TLink>
          </div>
        </div>
        <dialog
          id="home-voices-picker"
          className={styles.picker}
          aria-labelledby="home-voices-picker-title"
          data-voices-picker=""
          data-lenis-prevent=""
        >
          <div className={styles.pickerHeader}>
            <h3 id="home-voices-picker-title">{VOICES_UI.chooser}</h3>
            <button
              type="button"
              className={styles.close}
              aria-label="Close character picker"
              data-voices-close=""
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="m5 5 10 10m0-10L5 15" />
              </svg>
            </button>
          </div>
          <div
            className={styles.chooser}
            role="group"
            aria-labelledby="home-voices-picker-title"
            data-voices-tabs=""
          >
            {VOICE_CHARACTERS.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={c.slug === VOICES.defaultCharacter}
                aria-controls={`voices-panel-${c.slug}`}
                className={styles.tab}
                data-voices-tab={c.slug}
                data-original-crop={APPROVED_POSITION[c.slug] ? "" : undefined}
                style={artStyle(c)}
              >
                <span className={styles.thumb} data-src={c.splash} aria-hidden="true" />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </dialog>
      </div>
    ),
  };
}
