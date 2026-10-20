"use client";

import { useMemo } from "react";

import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { withSound } from "@/lib/sound-prompt";

import styles from "./about.module.css";

const LINES = new Map(getCharacter("selena").voice.map((l) => [l.n, l]));

/** The numbers of Selena's voice lines, for the content tests. */
export const SELENA_VOICE_NUMBERS: ReadonlySet<number> = new Set(LINES.keys());

/** One half of a line that has two parts, such as line 9 (see gallery-data.ts). */
export interface VoicePart {
  /** Shown after the number, for example "first part". */
  name: string;
  /** Public path of the half's file (no leading slash). */
  file: string;
  jp: string;
  en: string;
}

interface Props {
  n: number;
  /** Plays and shows this half of the line in place of the whole line. */
  part?: VoicePart;
  /** One line that says why the line sits here. */
  why?: string;
  /** A label above the line, for the profile. */
  label?: string;
}

/**
 * One of her voice lines: the Japanese words, the English translation and a button that plays it.
 * One line plays at a time, and playing it again stops it.
 */
export function VoiceCard({ n, part, why, label }: Props) {
  const line = LINES.get(n);
  const voice = useVoiceState();
  const file = part?.file ?? line?.file;
  const url = useMemo(() => (file ? asset(`/${file}`) : ""), [file]);
  if (!line) return null;
  const jp = part?.jp ?? line.jpTitle;
  const en = part?.en ?? line.en;
  const playing = voice.playing && voice.url === url;
  return (
    <figure className={styles.voice} data-playing={playing}>
      <button
        type="button"
        className={styles.voiceButton}
        aria-pressed={playing}
        aria-label={`${playing ? "Stop" : "Play"} voice line ${n}${part ? `, ${part.name}` : ""}: ${en}`}
        data-cursor={playing ? "STOP" : "HEAR"}
        onClick={() => {
          audio.unlock();
          if (playing) audio.stopVoice();
          else withSound("This voice line", () => void audio.playVoice(url));
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
          {part ? ` · ${part.name}` : ""}
        </span>
        <span className={styles.voiceJp} lang="ja">
          {jp}
        </span>
        <span className={styles.voiceEn}>{en}</span>
        {why ? <span className={styles.voiceWhy}>{why}</span> : null}
      </figcaption>
    </figure>
  );
}
