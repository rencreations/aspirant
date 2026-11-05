"use client";

import type { Route } from "next";
import { memo, type CSSProperties } from "react";

import { Waveform } from "@/components/audio/waveform";
import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { collectionRoute } from "@/lib/site";

import { downloadFile } from "./download";
import { Icon } from "./icons";
import { clock, downloadName, shortLength } from "./logic";
import { lineUrl } from "./playback";
import type { VoiceItem, VoiceLang } from "./types";
import styles from "./voicelines.module.css";

interface LineRowProps {
  item: VoiceItem;
  name: string;
  lang: VoiceLang;
  playing: boolean;
  /** The row a link or the random button pointed at. */
  target: boolean;
  /** Colour of the speaker (a trailer clip row follows who speaks, not the panel). */
  accent?: string;
  onToggle: (item: VoiceItem) => void;
}

/** One voice line: play button, number, the Japanese and the English, a note, the length and a link to the lossless file. */
export const LineRow = memo(function LineRow({
  item,
  name,
  lang,
  playing,
  target,
  accent,
  onToggle,
}: LineRowProps) {
  const nn = String(item.n).padStart(2, "0");
  const trailer = item.group === "trailer";
  const showJp = lang !== "en";
  const showEn = lang !== "ja";
  const label = trailer
    ? `Play trailer clip ${item.n}, ${item.speaker ?? name}`
    : `Play ${name}, line ${nn}`;
  const style = accent ? ({ "--accent": accent } as CSSProperties) : undefined;

  return (
    <li
      id={item.id}
      className={styles.row}
      data-playing={playing}
      data-target={target}
      style={style}
    >
      <button
        type="button"
        className={styles.play}
        data-voice-play
        aria-label={label}
        aria-pressed={playing}
        onClick={() => {
          onToggle(item);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") audio.preloadVoice(lineUrl(item));
        }}
        onFocus={() => {
          audio.preloadVoice(lineUrl(item));
        }}
      >
        <Icon name={playing ? "stop" : "play"} />
      </button>

      <span className={`${styles.num} hud-label`}>{trailer ? `${item.speaker ?? name}` : nn}</span>

      <div className={styles.text}>
        {showJp ? (
          <p className={styles.jp} lang="ja">
            {item.jp}
          </p>
        ) : null}
        {showEn && item.en ? <p className={styles.en}>{item.en}</p> : null}
        {trailer && item.sub && showEn ? (
          <p className={styles.sub}>
            <span className="hud-label">Trailer subtitle</span> {item.sub}
          </p>
        ) : null}
        {item.note ? (
          <p className={styles.note}>
            <span className="hud-label">Note</span> {item.note}
          </p>
        ) : null}
      </div>

      <div className={styles.side}>
        {playing ? (
          <Waveform url={lineUrl(item)} bars={26} className={styles.wave} />
        ) : (
          <span className={`${styles.time} hud-label`}>
            {item.dur < 10 ? shortLength(item.dur) : clock(item.dur)}
          </span>
        )}
        <span className={styles.links}>
          {trailer && item.film ? (
            <TLink
              href={
                `${collectionRoute("films")}?i=${item.film}&t=${Math.floor(item.t ?? 0)}` as Route
              }
              transitionLabel="Films"
              className={styles.linkBtn}
              aria-label={`Watch this moment in the trailer, at ${clock(item.t ?? 0)}`}
            >
              <Icon name="film" />
              <span>Trailer {clock(item.t ?? 0)}</span>
            </TLink>
          ) : null}
          {item.flac ? (
            <a
              className={styles.linkBtn}
              href={libUrl(item.flac)}
              download={downloadName(item)}
              aria-label={`Download the lossless FLAC of ${trailer ? "trailer clip" : "line"} ${nn}`}
              onClick={(e) => {
                e.preventDefault();
                void downloadFile(libUrl(item.flac ?? ""), downloadName(item));
              }}
            >
              <Icon name="download" />
              <span>FLAC</span>
            </a>
          ) : null}
        </span>
      </div>
    </li>
  );
});
