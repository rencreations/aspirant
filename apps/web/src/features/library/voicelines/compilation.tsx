"use client";

import { useEffect, useState } from "react";

import { audio } from "@/lib/audio";

import { Spectrum } from "../music/spectrum";
import { Icon } from "./icons";
import { clock } from "./logic";
import { seekCompilation, toggleCompilation, useCompilation } from "./playback";
import styles from "./voicelines.module.css";
import type { VoiceItem } from "./types";

interface CompilationProps {
  item: VoiceItem;
  name: string;
  lines: number;
}

/** The long recording of one character: a button, and once it plays a seek bar, the time and a live spectrum. */
export function Compilation({ item, name, lines }: CompilationProps) {
  const id = useCompilation((s) => s.id);
  const playing = useCompilation((s) => s.playing);
  const active = id === item.id;
  const on = active && playing;
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!active) return;
    const el = audio.getMusicElement();
    if (!el) return;
    const sync = () => {
      setTime(el.currentTime);
    };
    const onPlay = () => {
      useCompilation.setState({ playing: true });
    };
    const onPause = () => {
      useCompilation.setState({ playing: false });
    };
    sync();
    el.addEventListener("timeupdate", sync);
    el.addEventListener("seeked", sync);
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    return () => {
      el.removeEventListener("timeupdate", sync);
      el.removeEventListener("seeked", sync);
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [active]);

  const shown = active ? Math.min(time, item.dur) : 0;
  return (
    <div className={styles.comp} data-active={active} data-playing={on}>
      <button
        type="button"
        className={styles.compBtn}
        aria-pressed={on}
        aria-label={`${on ? "Pause" : "Play"} the full compilation of ${name}`}
        onClick={() => {
          toggleCompilation(item);
        }}
      >
        <Icon name={on ? "pause" : "play"} />
      </button>
      <div className={styles.compBody}>
        <p className={`${styles.compTitle} hud-label`}>
          Full compilation
          <span className={styles.compMeta}>
            {lines} lines, {clock(item.dur)}
          </span>
        </p>
        <div className={styles.compSeek} data-on={active}>
          <span className={`${styles.compTime} hud-label`}>{clock(shown)}</span>
          <input
            type="range"
            aria-label={`Position in the compilation of ${name}`}
            min={0}
            max={Math.max(1, Math.round(item.dur * 10) / 10)}
            step={0.1}
            value={shown}
            disabled={!active}
            onChange={(e) => {
              const next = Number(e.target.value);
              setTime(next);
              seekCompilation(next);
            }}
            style={
              { "--fill": `${item.dur ? (shown / item.dur) * 100 : 0}%` } as React.CSSProperties
            }
          />
          <span className={`${styles.compTime} hud-label`}>{clock(item.dur)}</span>
        </div>
      </div>
      <Spectrum playing={on} bars={28} className={styles.compWave} />
    </div>
  );
}
