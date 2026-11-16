"use client";

import { memo } from "react";

import { Waveform } from "@/components/audio/waveform";
import { audio } from "@/lib/audio";

import { downloadFile } from "./download";
import { Icon } from "./icons";
import { langInfo, type LangId } from "./languages";
import {
  downloadName,
  lineAudioUrl,
  lineOriginal,
  pad,
  shortLength,
  type Translation,
} from "./model";
import type { VoiceLine } from "./types";
import styles from "./character.module.css";

interface LineRowProps {
  slug: string;
  /** The name of the Aspirant, for the file name and the labels. */
  name: string;
  lang: LangId;
  line: VoiceLine;
  translation: Translation | null;
  /** The URL that plays now, or null. */
  playingUrl: string | null;
  /** The row an address (`?i=`) pointed at. */
  target: boolean;
  onPlay: (line: VoiceLine, url: string) => void;
  onPick: (n: number) => void;
}

/**
 * One voice line. A line with no recording still shows its text, and says so.
 *
 * Text and translation each carry the `lang` and `dir` of their own language (Arabic reads right to
 * left) and are never changed to upper case.
 */
export const LineRow = memo(function LineRow({
  slug,
  name,
  lang,
  line,
  translation,
  playingUrl,
  target,
  onPlay,
  onPick,
}: LineRowProps) {
  const info = langInfo(lang);
  const nn = pad(line.n);
  const hasAudio = line.d !== undefined;
  const url = lineAudioUrl(slug, lang, line.n);
  const playing = playingUrl === url;
  const original = lineOriginal(slug, lang, line);
  const file = downloadName(name, lang, line.n, original.ext);
  const trInfo = translation ? langInfo(translation.lang) : null;
  const trUrl =
    translation?.line && translation.lang !== "jp"
      ? lineAudioUrl(slug, translation.lang, translation.line.n)
      : null;
  const trPlaying = trUrl !== null && playingUrl === trUrl;

  return (
    <li
      id={`line-${nn}`}
      className={styles.row}
      data-playing={playing || trPlaying}
      data-target={target}
      data-missing={hasAudio ? undefined : ""}
    >
      <button
        type="button"
        className={styles.play}
        data-voice-play
        disabled={!hasAudio}
        aria-label={`Play ${name}, line ${nn}`}
        aria-pressed={playing}
        onClick={() => {
          onPlay(line, url);
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && hasAudio) audio.preloadVoice(url);
        }}
        onFocus={() => {
          if (hasAudio) audio.preloadVoice(url);
        }}
      >
        <Icon name={playing ? "stop" : "play"} />
      </button>

      <a
        href={`?lang=${lang}&i=${nn}`}
        className={`${styles.num} hud-label`}
        aria-label={`Line ${nn}, link to it`}
        onClick={(event) => {
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return;
          event.preventDefault();
          onPick(line.n);
        }}
      >
        {nn}
      </a>

      <div className={styles.text}>
        <p className={styles.main} lang={info.html} dir={info.dir}>
          {line.t}
        </p>
        {translation && trInfo ? (
          <p className={styles.tr}>
            <span className={`${styles.trTag} hud-label`}>{trInfo.english}</span>
            <span lang={trInfo.html} dir={trInfo.dir}>
              {translation.text}
            </span>
            {trUrl ? (
              <button
                type="button"
                className={styles.trPlay}
                aria-label={`Play this line in ${trInfo.english}`}
                aria-pressed={trPlaying}
                onClick={() => {
                  if (translation.line) onPlay(translation.line, trUrl);
                }}
              >
                <Icon name={trPlaying ? "stop" : "play"} />
              </button>
            ) : null}
          </p>
        ) : null}
        {line.note ? (
          <p className={styles.note}>
            <span className="hud-label">Note</span> {line.note}
          </p>
        ) : null}
        {hasAudio ? null : <p className={styles.note}>No recording of this line yet.</p>}
      </div>

      <div className={styles.side}>
        {playing || trPlaying ? (
          <Waveform url={playing ? url : (trUrl ?? url)} bars={24} className={styles.wave} />
        ) : hasAudio && line.d !== undefined ? (
          <span className={`${styles.time} hud-label`}>{shortLength(line.d)}</span>
        ) : null}
        {hasAudio ? (
          <a
            className={styles.save}
            href={original.url}
            download={file}
            aria-label={`Download line ${nn} as ${original.ext.toUpperCase()}`}
            onClick={(event) => {
              event.preventDefault();
              void downloadFile(original.url, file);
            }}
          >
            <Icon name="download" />
            <span>{original.ext.toUpperCase()}</span>
          </a>
        ) : null}
      </div>
    </li>
  );
});
