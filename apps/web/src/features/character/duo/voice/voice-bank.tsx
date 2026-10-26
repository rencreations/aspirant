"use client";

import { useMemo } from "react";

import { Waveform } from "@/components/audio/waveform";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { withSound } from "@/lib/sound-prompt";

import type { Who } from "../duo-data";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./voice-bank.module.css";

interface BankLine {
  n: number;
  jp: string;
  en: string;
  src: string;
  duration: number | null;
}

interface Props {
  who: Who;
  name: string;
  label: string;
  idle: string;
  lines: readonly BankLine[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * All of her voice lines as a bank of keys. Ruby's are keycaps in a grid, Angela's are bubbles.
 * One line plays at a time (the audio engine stops the last one); the panel above shows the
 * Japanese title, the English and a live waveform. A press on a playing key stops it.
 */
export function VoiceBank({ who, name, label, idle, lines }: Props) {
  const ref = useReveal<HTMLElement>();
  const voice = useVoiceState();
  const resolved = useMemo(() => lines.map((l) => ({ ...l, url: asset(l.src) })), [lines]);
  const current = resolved.find((l) => voice.playing && l.url === voice.url);

  const press = (url: string) => {
    audio.unlock();
    if (voice.playing && voice.url === url) audio.stopVoice();
    else withSound("This voice line", () => void audio.playVoice(url));
  };
  const random = () => {
    const pick = resolved[Math.floor(Math.random() * resolved.length)];
    if (pick) press(pick.url);
  };

  return (
    <section ref={ref} className={styles.section} data-who={who} aria-labelledby={`${who}-voice`}>
      <Head
        id={`${who}-voice`}
        index="04"
        label={label}
        title={who === "ruby" ? "Forty keys" : "Her voice"}
      >
        {`All ${lines.length} of ${name}'s lines, in Japanese with the English translation.`}
      </Head>
      <div className={styles.now} aria-live="polite" data-reveal>
        <div className={styles.nowText}>
          <p className={styles.nowLabel}>{current ? `Line ${pad(current.n)}` : "Standing by"}</p>
          {current ? (
            <>
              <p className={styles.jp} lang="ja">
                {current.jp}
              </p>
              <p className={styles.en}>{current.en}</p>
            </>
          ) : (
            <p className={styles.en}>{idle}</p>
          )}
        </div>
        <Waveform className={styles.wave} bars={56} />
        <button type="button" className={styles.random} onClick={random}>
          Surprise me
        </button>
      </div>
      <ul className={styles.keys} data-reveal>
        {resolved.map((l) => {
          const on = voice.playing && l.url === voice.url;
          return (
            <li key={l.n}>
              <button
                type="button"
                className={styles.key}
                data-on={on}
                aria-pressed={on}
                aria-label={`Line ${l.n}: ${l.en}`}
                title={l.en}
                onClick={() => {
                  press(l.url);
                }}
              >
                <span className={styles.keyNum}>{pad(l.n)}</span>
                <span className={styles.keyJp} lang="ja">
                  {l.jp}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
