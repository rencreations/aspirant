import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { Flag } from "@/features/library/voicelines/flags";
import type { FlagId } from "@/features/library/voicelines/languages";
import { collectionRoute } from "@/lib/site";

import { VOICES, VOICES_UI } from "../../content";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import {
  ART_POSITION,
  VOICE_CHARACTERS,
  VOICE_LANGUAGES,
  splitDirections,
  type VoiceCharacter,
  type VoiceLanguage,
} from "./data";
import styles from "./voices.module.css";

const tone = (c: VoiceCharacter): CSSProperties =>
  ({
    "--tone": c.palette.primary,
    "--tone-ink": c.palette.ink,
    "--pos": ART_POSITION[c.slug] ?? "50% 40%",
  }) as CSSProperties;

/** The text of a line, with a stage direction (for example "(Chuckles)") drawn small and quiet. */
function LineText({ text }: { text: string }) {
  return (
    <>
      {splitDirections(text).map((part, i) =>
        part.direction ? (
          <span key={i} className={styles.direction}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

function Row({ c, l, index }: { c: VoiceCharacter; l: VoiceLanguage; index: number }) {
  const line = c.lines[l.id];
  if (!line) return null;
  const label = `${VOICES_UI.play} ${c.name}, ${l.english}`;
  return (
    <li
      className={styles.line}
      data-voices-line=""
      data-key={line.key}
      data-gain={line.g}
      data-seconds={line.d}
      data-state="idle"
      style={{ "--row": index } as CSSProperties}
    >
      <button type="button" className={styles.play} data-voices-play="" aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path className={styles.iconPlay} d="M8 5.5v13l11-6.5z" />
          <path className={styles.iconBars} d="M7 6h3v12H7zM14 6h3v12h-3z" />
        </svg>
        <span className={styles.ring} aria-hidden="true" />
      </button>
      <div className={styles.lineBody}>
        <span className={styles.tag}>
          <Flag id={l.flag as FlagId} className={styles.flag} />
          <span lang={l.html} dir={l.dir}>
            {l.native}
          </span>
        </span>
        <p className={styles.text} lang={line.lang} dir={line.dir}>
          <LineText text={line.t} />
        </p>
        {l.id === "jp" && line.tr ? (
          <p className={styles.translation} lang="en">
            {line.tr}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** What the server draws for the section: the chooser, every Aspirant's eight lines, the button. */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={styles.art} data-voices-art="">
        <div className={styles.artFrame}>
          {VOICE_CHARACTERS.map((c, i) => (
            <div
              key={c.slug}
              className={styles.fig}
              data-voices-fig={c.slug}
              data-active={i === 0 ? "1" : "0"}
              style={tone(c)}
            />
          ))}
        </div>
      </div>
    ),
    text: (
      <div className={styles.voices} data-voices="">
        <h2 className={styles.title} data-voices-part="title">
          {VOICES.title}
        </h2>
        <div
          className={styles.chooser}
          role="tablist"
          aria-label={VOICES_UI.chooser}
          data-voices-tabs=""
          data-voices-part="chooser"
        >
          {VOICE_CHARACTERS.map((c, i) => (
            <button
              key={c.slug}
              type="button"
              role="tab"
              id={`voices-tab-${c.slug}`}
              aria-selected={i === 0}
              aria-controls={`voices-panel-${c.slug}`}
              tabIndex={i === 0 ? 0 : -1}
              className={styles.tab}
              data-voices-tab={c.slug}
              style={tone(c)}
            >
              <span className={styles.thumb} data-src={c.splash} aria-hidden="true" />
              <span className={styles.tabName}>{c.name}</span>
            </button>
          ))}
        </div>
        <div className={styles.panels} data-voices-part="panels">
          {VOICE_CHARACTERS.map((c, i) => (
            <section
              key={c.slug}
              className={styles.panel}
              role="tabpanel"
              id={`voices-panel-${c.slug}`}
              aria-labelledby={`voices-tab-${c.slug}`}
              data-voices-panel={c.slug}
              data-active={i === 0 ? "1" : "0"}
              style={tone(c)}
            >
              <h3 className={styles.who}>
                <span>{c.name}</span>
                <span className={styles.jp} lang="ja">
                  {c.jp}
                </span>
              </h3>
              <ol className={styles.lines}>
                {VOICE_LANGUAGES.map((l, row) => (
                  <Row key={l.id} c={c} l={l} index={row} />
                ))}
              </ol>
              <p className={styles.plainLink}>
                <TLink href={collectionRoute(`voicelines/${c.slug}`)} transitionLabel={c.name}>
                  {VOICES_UI.herLines}
                </TLink>
              </p>
            </section>
          ))}
        </div>
        <div className={styles.actions} data-voices-part="actions">
          <Pill href={VOICES.button.href} label="Voicelines">
            {VOICES.button.label}
          </Pill>
        </div>
      </div>
    ),
  };
}
