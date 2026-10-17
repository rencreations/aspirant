"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Waveform } from "@/components/audio/waveform";
import { SoundToggle } from "@/components/hud/preference-toggles";
import { StarButton } from "@/components/ui/star-button";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useMounted, useVoiceState } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { SectionHead } from "./section-head";
import styles from "./voice-wall.module.css";

export interface WallLine {
  readonly n: number;
  readonly jp: string;
  readonly en: string;
  readonly src: string;
  readonly duration: number | null;
  readonly note?: string;
}

interface VoiceWallProps {
  name: string;
  lines: readonly WallLine[];
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatDuration(sec: number | null): string {
  if (sec === null) return "--";
  const s = Math.round(sec * 10) / 10;
  return `${s.toFixed(1)} s`;
}

/**
 * Every voice line as a playable wall: Japanese title, English translation and length.
 * One line plays at a time (the audio engine stops the last). Arrow keys move between lines,
 * Enter or Space plays or stops, Home and End jump. Search filters by text or number.
 */
export function VoiceWall({ name, lines }: VoiceWallProps) {
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const voice = useVoiceState();
  const muted = useSiteStore((s) => s.muted);
  const mounted = useMounted();
  const listRef = useRef<HTMLUListElement>(null);
  const helpId = useId();
  const searchId = useId();

  const resolved = useMemo(() => lines.map((l) => ({ ...l, url: asset(l.src) })), [lines]);
  const q = query.trim().toLowerCase();
  const shown = q
    ? resolved.filter(
        (l) =>
          l.en.toLowerCase().includes(q) ||
          l.jp.includes(query.trim()) ||
          String(l.n) === q.replace(/^0+/, ""),
      )
    : resolved;
  const current = resolved.find((l) => voice.playing && l.url === voice.url);
  const active = Math.min(focusIndex, Math.max(0, shown.length - 1));

  const toggle = (url: string) => {
    audio.unlock();
    if (voice.playing && voice.url === url) audio.stopVoice();
    else void audio.playVoice(url);
  };

  const playRandom = () => {
    const pool = shown.length ? shown : resolved;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    audio.unlock();
    void audio.playVoice(pick.url);
    const i = shown.indexOf(pick);
    if (i >= 0) setFocusIndex(i);
  };

  const columns = () => {
    const list = listRef.current;
    const first = list?.children[0] as HTMLElement | undefined;
    if (!list || !first) return 1;
    return Math.max(1, Math.round(list.clientWidth / first.offsetWidth));
  };

  const move = (to: number) => {
    const next = Math.max(0, Math.min(shown.length - 1, to));
    setFocusIndex(next);
    const button = listRef.current?.querySelectorAll<HTMLButtonElement>("button")[next];
    button?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const cols = columns();
    const keys: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      ArrowDown: active + cols,
      ArrowUp: active - cols,
      Home: 0,
      End: shown.length - 1,
    };
    const to = keys[e.key];
    if (to === undefined) return;
    e.preventDefault();
    move(to);
  };

  return (
    <section aria-labelledby="voice-title" className={`${styles.section} shell`}>
      <SectionHead id="voice-title" index="03" code="Voice archive" title="Voice wall">
        {`All ${lines.length} of ${name}'s lines, in Japanese with the English translation.`}
      </SectionHead>

      <div className={styles.console}>
        <div className={styles.now} aria-live="polite">
          <p className="hud-label">{current ? `Playing line ${pad(current.n)}` : "Standing by"}</p>
          <Waveform className={styles.wave} bars={64} />
          <p className={styles.nowText}>
            {current ? (
              <>
                <span lang="ja" className={styles.nowJp}>
                  {current.jp}
                </span>
                <span>{current.en}</span>
              </>
            ) : (
              <span>Pick a line, or let the archive choose one.</span>
            )}
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.search}>
            <label htmlFor={searchId} className="hud-label">
              Search lines
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusIndex(0);
              }}
              placeholder="Words, Japanese or a number"
              autoComplete="off"
              className={styles.input}
            />
          </div>
          <StarButton variant="ghost" size="sm" onClick={playRandom} blip="click">
            Play random
          </StarButton>
          {mounted && muted && (
            <p className={styles.muted}>
              <SoundToggle labeled />
              <span>Sound is off. Turn it on to hear the lines.</span>
            </p>
          )}
        </div>
      </div>

      <p id={helpId} className="sr-only">
        Use the arrow keys to move between lines, and Enter or Space to play or stop one.
      </p>
      <p className={`${styles.count} hud-label`} aria-live="polite">
        {q ? `${shown.length} of ${lines.length} lines match` : `${lines.length} lines`}
      </p>

      <ul ref={listRef} className={styles.wall} aria-describedby={helpId} onKeyDown={onKeyDown}>
        {shown.map((l, i) => {
          const playing = voice.playing && voice.url === l.url;
          return (
            <li key={l.n} className={styles.cell}>
              <button
                type="button"
                className={styles.line}
                aria-pressed={playing}
                tabIndex={i === active ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onClick={() => {
                  setFocusIndex(i);
                  toggle(l.url);
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") {
                    audio.blip("hover");
                    audio.preloadVoice(l.url);
                  }
                }}
                data-cursor={playing ? "STOP" : "PLAY"}
              >
                <span className={styles.lineTop}>
                  <span className={styles.num}>{pad(l.n)}</span>
                  <span className={styles.icon} aria-hidden="true">
                    {playing ? (
                      <svg viewBox="0 0 12 12">
                        <rect x="2" y="2" width="3" height="8" fill="currentColor" />
                        <rect x="7" y="2" width="3" height="8" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 12 12">
                        <path d="M3 1.5l7 4.5-7 4.5z" fill="currentColor" />
                      </svg>
                    )}
                  </span>
                  <span className={styles.duration}>
                    <span className="sr-only">Length </span>
                    {formatDuration(l.duration)}
                  </span>
                </span>
                <span className={styles.jp} lang="ja">
                  {l.jp}
                </span>
                <span className={styles.en}>{l.en}</span>
                {l.note && <span className={styles.note}>{l.note}</span>}
                {playing && <Waveform url={l.url} bars={24} className={styles.lineWave} />}
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className={styles.empty}>No line matches that search.</p>}
    </section>
  );
}
