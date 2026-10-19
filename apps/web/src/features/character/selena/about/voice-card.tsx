"use client";

import { useMemo } from "react";

import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";

import styles from "./about.module.css";

const LINES = new Map(getCharacter("selena").voice.map((l) => [l.n, l]));

/** The numbers of Selena's voice lines, for the content tests. */
export const SELENA_VOICE_NUMBERS: ReadonlySet<number> = new Set(LINES.keys());

interface Props {
  n: number;
  /** One line that says why the line sits here. */
  why?: string;
  /** A label above the line, for the profile. */
  label?: string;
}

/**
 * One of her voice lines: the Japanese words, the English translation and a button that plays it.
 * One line plays at a time, and playing it again stops it.
 */
export function VoiceCard({ n, why, label }: Props) {
  const line = LINES.get(n);
  const voice = useVoiceState();
  const url = useMemo(() => (line ? asset(`/${line.file}`) : ""), [line]);
  if (!line) return null;
  const playing = voice.playing && voice.url === url;
  return (
    <figure className={styles.voice} data-playing={playing}>
      <button
        type="button"
        className={styles.voiceButton}
        aria-pressed={playing}
        aria-label={`${playing ? "Stop" : "Play"} voice line ${n}: ${line.en}`}
        data-cursor={playing ? "STOP" : "HEAR"}
        onClick={() => {
          audio.unlock();
          if (playing) audio.stopVoice();
          else void audio.playVoice(url);
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          {playing ? (
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
          ) : (
            <path d="M8 5v14l11-7z" fill="currentColor" />
          )}
        </svg>
        <span className={styles.voiceBars} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>
      <figcaption className={styles.voiceText}>
        <span className={styles.voiceMeta}>
          {label ? `${label} · ` : ""}Voice line {String(n).padStart(2, "0")}
        </span>
        <span className={styles.voiceJp} lang="ja">
          {line.jpTitle}
        </span>
        <span className={styles.voiceEn}>{line.en}</span>
        {why ? <span className={styles.voiceWhy}>{why}</span> : null}
      </figcaption>
    </figure>
  );
}
