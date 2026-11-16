"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { Waveform } from "@/components/audio/waveform";
import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { Spectrum } from "../music/spectrum";
import { videoHref } from "../video/links";
import { downloadFile } from "./download";
import { Icon } from "./icons";
import { clock, shortLength } from "./model";
import { seekRecording, toggleRecording, useRecording } from "./playback";
import type { VoiceCharacterFile, VoiceTrailerClip } from "./types";
import styles from "./character.module.css";

/** The long recording of the Japanese lines: a button, and once it plays a seek bar, the time and a live spectrum. */
export function Recording({
  recording,
  name,
  lines,
}: {
  recording: VoiceCharacterFile["full"];
  name: string;
  lines: number;
}) {
  const id = useRecording((s) => s.id);
  const playing = useRecording((s) => s.playing);
  const active = id === recording.id;
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
      useRecording.setState({ playing: true });
    };
    const onPause = () => {
      useRecording.setState({ playing: false });
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

  const shown = active ? Math.min(time, recording.d) : 0;
  return (
    <section
      className={styles.recording}
      data-active={active}
      data-playing={on}
      aria-label="Full recording"
      data-voicelines-recording=""
    >
      <button
        type="button"
        className={styles.recBtn}
        aria-pressed={on}
        aria-label={`${on ? "Pause" : "Play"} the full recording of ${name}`}
        onClick={() => {
          toggleRecording(recording);
        }}
      >
        <Icon name={on ? "pause" : "play"} />
      </button>
      <div className={styles.recBody}>
        <p className={`${styles.recTitle} hud-label`}>
          Full recording
          <span className={styles.recMeta}>
            {lines} lines, {clock(recording.d)}
          </span>
        </p>
        <div className={styles.recSeek} data-on={active}>
          <span className={`${styles.recTime} hud-label`}>{clock(shown)}</span>
          <input
            type="range"
            aria-label={`Position in the full recording of ${name}`}
            min={0}
            max={Math.max(1, Math.round(recording.d * 10) / 10)}
            step={0.1}
            value={shown}
            disabled={!active}
            onChange={(e) => {
              const next = Number(e.target.value);
              setTime(next);
              seekRecording(next);
            }}
            style={
              { "--fill": `${recording.d ? (shown / recording.d) * 100 : 0}%` } as CSSProperties
            }
          />
          <span className={`${styles.recTime} hud-label`}>{clock(recording.d)}</span>
        </div>
      </div>
      <Spectrum playing={on} bars={28} className={styles.recWave} />
    </section>
  );
}

/**
 * The Japanese clips cut from the trailers. Each has its own recording and the trailer's subtitle (or
 * a tentative translation, which says so). A clip of the Ruby and Angela trailer links to its moment
 * in the film.
 */
export function TrailerClips({
  clips,
  playingUrl,
  onPlay,
}: {
  clips: readonly VoiceTrailerClip[];
  playingUrl: string | null;
  onPlay: (url: string) => void;
}) {
  return (
    <section className={styles.trailer} aria-labelledby="vl-trailer-h" data-voicelines-trailer="">
      <h2 id="vl-trailer-h" className={`${styles.sectionTitle} display`}>
        Trailer clips
      </h2>
      <p className={styles.sectionLead}>
        Japanese clips cut from the trailers, with the subtitle of the trailer or a translation that
        was not checked by ear.
      </p>
      <ol className={styles.lines}>
        {clips.map((clip) => {
          const url = libUrl(clip.m4a);
          const playing = playingUrl === url;
          const file = `${clip.who} - trailer clip ${String(clip.n).padStart(2, "0")}.flac`;
          return (
            <li key={clip.id} id={clip.id} className={styles.row} data-playing={playing}>
              <button
                type="button"
                className={styles.play}
                data-voice-play
                aria-label={`Play trailer clip ${clip.n}, ${clip.who}`}
                aria-pressed={playing}
                onClick={() => {
                  onPlay(url);
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") audio.preloadVoice(url);
                }}
              >
                <Icon name={playing ? "stop" : "play"} />
              </button>
              <span className={`${styles.num} hud-label`}>{String(clip.n).padStart(2, "0")}</span>
              <div className={styles.text}>
                <p className={styles.main} lang="ja">
                  {clip.t}
                </p>
                {clip.tr ? (
                  <p className={styles.tr}>
                    <span className={`${styles.trTag} hud-label`}>{clip.who}</span>
                    <span lang="en">{clip.tr}</span>
                  </p>
                ) : null}
                {clip.note ? <p className={styles.note}>{clip.note}</p> : null}
              </div>
              <div className={styles.side}>
                {playing ? (
                  <Waveform url={url} bars={24} className={styles.wave} />
                ) : (
                  <span className={`${styles.time} hud-label`}>{shortLength(clip.d)}</span>
                )}
                <span className={styles.links}>
                  {clip.film ? (
                    <TLink
                      href={videoHref(clip.film, Math.floor(clip.at ?? 0), "voicelines")}
                      transitionLabel="Films"
                      className={styles.save}
                      aria-label={`Watch this moment in the trailer, at ${clock(clip.at ?? 0)}`}
                    >
                      <Icon name="film" />
                      <span>Trailer {clock(clip.at ?? 0)}</span>
                    </TLink>
                  ) : null}
                  <a
                    className={styles.save}
                    href={libUrl(clip.flac)}
                    download={file}
                    aria-label={`Download trailer clip ${clip.n} as FLAC`}
                    onClick={(event) => {
                      event.preventDefault();
                      void downloadFile(libUrl(clip.flac), file);
                    }}
                  >
                    <Icon name="download" />
                    <span>FLAC</span>
                  </a>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
