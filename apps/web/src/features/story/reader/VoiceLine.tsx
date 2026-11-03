"use client";

import { useMemo, type CSSProperties } from "react";

import { Waveform } from "@/components/audio/waveform";
import { characters } from "@/content/characters";
import type { VoiceRef } from "@/content/story-types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { withSound } from "@/lib/sound-prompt";

import { portraitFor, SPEAKER_ACCENT } from "./portraits";
import s from "./reader.module.css";

/**
 * The player under a line of speech that is also a recorded voice line: the speaker's round
 * portrait, a play button, her name and, while it plays, the waveform. One line plays at a time;
 * pressing the one that plays stops it. If the site sound is off, the sound prompt asks first.
 */
export function VoiceLine({ voice }: { voice: VoiceRef }) {
  const state = useVoiceState();
  const url = useMemo(() => asset(`/${voice.src}`), [voice.src]);
  const playing = state.playing && state.url === url;
  const person = characters.find((c) => c.slug === voice.slug);
  const name = person?.name ?? voice.slug;
  const face = portraitFor(voice.slug);
  return (
    <div
      className={s.voice}
      data-playing={playing}
      style={{ "--accent": SPEAKER_ACCENT[voice.slug] ?? "var(--cyan)" } as CSSProperties}
    >
      <button
        type="button"
        className={s.voiceButton}
        aria-pressed={playing}
        aria-label={`${playing ? "Stop" : "Play"} the voice line of ${name}`}
        data-cursor={playing ? "STOP" : "HEAR"}
        onClick={() => {
          audio.unlock();
          if (playing) audio.stopVoice();
          else withSound("This voice line", () => void audio.playVoice(url));
        }}
      >
        <span className={s.voiceFace} aria-hidden="true">
          {face && (
            <>
              {/* Plain <img>: static export. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(face.src)}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{ objectPosition: face.position }}
              />
            </>
          )}
        </span>
        <span className={s.voiceIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
            {playing ? (
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
            ) : (
              <path d="M8 5v14l11-7z" fill="currentColor" />
            )}
          </svg>
        </span>
        <span className={s.voiceText}>
          <span className={s.voiceName}>{name}</span>
          <span className={s.voiceKind}>Voice line</span>
        </span>
        <Waveform url={url} bars={36} className={s.voiceWave} />
      </button>
    </div>
  );
}
