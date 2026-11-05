"use client";

import { memo, type CSSProperties } from "react";

import { LineRow } from "./line-row";
import { useReveal } from "./panel";
import type { VoiceCharacter, VoiceItem, VoiceLang } from "./types";
import styles from "./voicelines.module.css";

interface TrailerPanelProps {
  clips: readonly VoiceItem[];
  characters: readonly VoiceCharacter[];
  lang: VoiceLang;
  playingId: string | null;
  targetId: string | null;
  onToggle: (item: VoiceItem) => void;
}

const TRAILER_COLOUR = "#1E2A57";

/** The sixteen Japanese clips of the Ruby and Angela trailer, with the trailer's own subtitle beside them. */
export const TrailerPanel = memo(function TrailerPanel({
  clips,
  characters,
  lang,
  playingId,
  targetId,
  onToggle,
}: TrailerPanelProps) {
  const head = useReveal<HTMLElement>();
  const colours = new Map(characters.map((c) => [c.slug as string, c.palette.primary]));
  const names = new Map(characters.map((c) => [c.slug as string, c.name]));
  const style = {
    "--accent": TRAILER_COLOUR,
    "--accent-ink": "#0A0F24",
    "--accent-2": "#E0388E",
  } as CSSProperties;
  return (
    <section
      id="vl-trailer"
      className={styles.panel}
      style={style}
      aria-labelledby="vl-trailer-h"
      data-slug="trailer"
    >
      <header ref={head} className={`${styles.phead} ${styles.pheadPlain}`}>
        <div className={styles.pmain}>
          <p className={`${styles.pindex} hud-label`}>11 / Ruby and Angela trailer</p>
          <h2 id="vl-trailer-h" className={`${styles.pname} display`}>
            Trailer clips
          </h2>
          <p className={styles.plead}>
            Sixteen Japanese clips cut from the trailer. No official translation exists. The English
            is the trailer&apos;s own subtitle for the same moment, so it is not always word for
            word.
          </p>
          <p className={`${styles.pstats} hud-label`}>
            <span className={styles.pcount}>{clips.length}</span> clips
          </p>
        </div>
      </header>
      <ol className={styles.lines}>
        {clips.map((item) => (
          <LineRow
            key={item.id}
            item={item}
            name={names.get(item.slug) ?? item.slug}
            lang={lang}
            playing={playingId === item.id}
            target={targetId === item.id}
            accent={colours.get(item.slug)}
            onToggle={onToggle}
          />
        ))}
      </ol>
    </section>
  );
});
