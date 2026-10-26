"use client";

import { useMemo } from "react";

import type { VoiceLine } from "@/content/types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { withSound } from "@/lib/sound-prompt";

import styles from "./about.module.css";

/**
 * One voice line of the playlist: its number, the Japanese words, the English and a round play
 * button. One line plays at a time, and pressing the line that plays stops it.
 */
export function VoiceRow({ line }: { line: VoiceLine }) {
  const voice = useVoiceState();
  const url = useMemo(() => asset(`/${line.file}`), [line.file]);
  const playing = voice.playing && voice.url === url;
  return (
    <li className={styles.voiceItem} data-playing={playing}>
      <button
        type="button"
        className={styles.voiceButton}
        aria-pressed={playing}
        aria-label={`${playing ? "Stop" : "Play"} voice line ${line.n}: ${line.en}`}
        data-cursor={playing ? "STOP" : "HEAR"}
        onClick={() => {
          audio.unlock();
          if (playing) audio.stopVoice();
          else withSound("This voice line", () => void audio.playVoice(url));
        }}
      >
        <span className={styles.voiceNo}>{String(line.n).padStart(2, "0")}</span>
        <span className={styles.voiceText}>
          <span className={styles.voiceJp} lang="ja">
            {line.jpTitle}
          </span>
          <span className={styles.voiceEn}>{line.en}</span>
        </span>
        <span className={styles.voiceIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" focusable="false">
            {playing ? (
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
            ) : (
              <path d="M8 5v14l11-7z" fill="currentColor" />
            )}
          </svg>
          <span className={styles.voiceBars}>
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
      </button>
    </li>
  );
}
