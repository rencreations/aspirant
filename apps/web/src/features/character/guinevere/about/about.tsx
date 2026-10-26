"use client";

import { useRef } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { getCharacter } from "@/content/characters";
import { useInView } from "@/lib/hooks";

import { Dossier } from "./dossier";
import styles from "./about.module.css";
import { SkinFrame } from "./skin-frame";
import { VoicePlaylist } from "./voice-playlist";

const c = getCharacter("guinevere");

/**
 * The page lists 41 lines. Line 42 is a shorter take of line 36 ("Beneath the shooting star, we
 * meet again..."), so it is left out here; the character data keeps it.
 */
const VOICES = c.voice.filter((line) => line.n !== 42);

/**
 * Who she is, without the long story: the name in two scripts, her skin showcase in motion, a
 * registry file (a plate of figures and a sky of five notes) and the playlist of her voice lines.
 * Dusk colours, set as an editorial spread rather than a profile card.
 */
export function About({ covers = false }: { covers?: boolean }) {
  const rootRef = useRef<HTMLElement>(null);
  const seen = useInView(rootRef, { rootMargin: "0px 0px -12% 0px", once: true });

  return (
    <section
      ref={rootRef}
      id="about"
      className={covers ? `${styles.about} ${styles.covers}` : styles.about}
      data-in={seen}
      aria-labelledby="about-title"
    >
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowNo}>01</span>
          <span className={styles.eyebrowBar} aria-hidden="true" />
          <span>Registry entry</span>
        </p>
        <h2 id="about-title" className={styles.name}>
          <span className={styles.nameEcho} aria-hidden="true">
            Guinevere
          </span>
          <span className={styles.nameMain}>
            <span className="sr-only">Guinevere</span>
            {Array.from("Guinevere").map((ch, i) => (
              <span
                key={i}
                className={styles.letter}
                style={{ ["--i" as string]: i }}
                aria-hidden="true"
              >
                {ch}
              </span>
            ))}
          </span>
        </h2>
        <div className={styles.jp}>
          <span className={styles.jpKana} lang="ja">
            {c.jp.script}
          </span>
          <span className={styles.jpRoman}>{c.jp.romaji}</span>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.stage}>
          <div className={styles.stageHead}>
            <p className={styles.alias}>{c.aspirantName}</p>
            <p className={styles.tagline}>{c.tagline}</p>
          </div>
          <div className={styles.stageArt}>
            <div className={styles.ring} aria-hidden="true">
              <span className={styles.ringA} />
              <span className={styles.ringB} />
              <StarGlyph className={styles.ringStar} />
            </div>
            <SkinFrame />
          </div>
        </div>

        <div className={styles.side}>
          <Dossier />
        </div>
      </div>

      <div className={styles.voices}>
        <div className={styles.voicesHead}>
          <h3 className={styles.voicesTitle}>Hear her</h3>
          <p className={styles.voicesNote}>{VOICES.length} lines</p>
        </div>
        <VoicePlaylist lines={VOICES} />
      </div>
    </section>
  );
}
