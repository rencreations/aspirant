"use client";

import { useRef, type CSSProperties, type KeyboardEvent } from "react";

import { Waveform } from "@/components/audio/waveform";
import { StarButton } from "@/components/ui/star-button";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { CHARACTER_NAMES } from "@/lib/slugs";

import { formatDuration, pad2 } from "./format";
import { pairAccent } from "./frames";
import { voicePair, type VoiceRow } from "./voice-data";
import styles from "./voice.module.css";

interface VoiceArchiveProps {
  rows: readonly VoiceRow[];
  /** How many rows to show. */
  limit: number;
  /** Rows that match, before the limit. */
  matches: number;
  /** Show a "Show more" button when rows are hidden. */
  paged: boolean;
  onMore: () => void;
}

function VoiceLineRow({ row }: { row: VoiceRow }) {
  const voice = useVoiceState();
  const url = asset(row.file);
  const playing = voice.playing && voice.url === url;
  const name = CHARACTER_NAMES[row.slug];
  const accent = pairAccent(voicePair(row.slug));

  const toggle = () => {
    audio.unlock();
    if (playing) {
      audio.stopVoice();
    } else {
      audio.blip("click");
      void audio.playVoice(url);
    }
  };

  return (
    <li
      className={styles.row}
      data-playing={playing}
      style={{ "--accent": accent, "--glow": accent } as CSSProperties}
    >
      <StarButton
        emblem
        size="sm"
        variant={playing ? "solid" : "ghost"}
        aria-label={`Play ${name}, line ${row.n}`}
        aria-pressed={playing}
        data-cursor={playing ? "STOP" : "PLAY"}
        data-voice-play
        blip={false}
        onClick={toggle}
      />
      <div className={styles.who}>
        <span className={styles.name}>{name}</span>
        <span className={`${styles.num} hud-label`}>Line {pad2(row.n)}</span>
      </div>
      <div className={styles.text}>
        <p className={styles.jp} lang="ja">
          {row.jp}
        </p>
        <p className={styles.en}>{row.en}</p>
      </div>
      <div className={styles.side}>
        {playing ? (
          <Waveform url={url} bars={28} className={styles.wave} />
        ) : (
          <span className={`${styles.time} hud-label`}>{formatDuration(row.durationSec)}</span>
        )}
      </div>
    </li>
  );
}

/**
 * The voice lines as a list: character, Japanese title, English translation, a play button and,
 * for the line that plays, a live waveform. One line plays at a time (the shared engine stops
 * the last one). Up and Down move between the play buttons.
 */
export default function VoiceArchive({ rows, limit, matches, paged, onMore }: VoiceArchiveProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const shown = rows.slice(0, limit);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-voice-play]") ?? [],
    );
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    e.preventDefault();
    buttons[
      Math.min(buttons.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))
    ]?.focus();
  };

  if (matches === 0) {
    return (
      <p className={styles.empty}>
        No voice line matches. Try a name or a word from the translation.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <ul ref={listRef} className={styles.list} onKeyDown={onKeyDown}>
        {shown.map((row) => (
          <VoiceLineRow key={`${row.slug}-${row.n}`} row={row} />
        ))}
      </ul>
      {paged && (
        <div className={styles.more}>
          <p className="m-0 hud-label">
            Showing {shown.length} of {matches}
          </p>
          {shown.length < matches && (
            <StarButton variant="ghost" size="sm" onClick={onMore}>
              Show {Math.min(24, matches - shown.length)} more
            </StarButton>
          )}
        </div>
      )}
    </div>
  );
}
