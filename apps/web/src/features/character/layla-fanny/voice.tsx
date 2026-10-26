"use client";

import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { withSound } from "@/lib/sound-prompt";
import { CONFIG } from "./config";
import styles from "./lf.module.css";
import type { Who } from "./media";
import { Head, Reveal } from "./parts";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 03. Her voice lines as a wall of buttons. One plays at a time (the audio engine stops the last).
 * A playing line shows five bars that move; the bars are transforms and stop when it ends.
 */
export function Voice({ who }: { who: Who }) {
  const c = getCharacter(who);
  const voice = useVoiceState();
  const lines = c.voice.map((l) => ({ ...l, url: asset(`/${l.file}`) }));

  const toggle = (url: string) => {
    audio.unlock();
    if (voice.playing && voice.url === url) audio.stopVoice();
    else withSound("This voice line", () => void audio.playVoice(url));
  };

  const random = () => {
    const pick = lines[Math.floor(Math.random() * lines.length)];
    if (pick) toggle(pick.url);
  };

  return (
    <section
      id="voice"
      className={styles.voice}
      data-who={who}
      data-theme="storm"
      aria-labelledby="lf-voice"
    >
      <Head no={3} label="Voice" title="Voice lines" lead={CONFIG[who].voiceLead} id="lf-voice" />
      <div className={styles.voiceTools}>
        <button type="button" className={styles.pill} onClick={random} data-cursor="PLAY">
          Play a random line
        </button>
        <span className={styles.count}>{lines.length} lines</span>
      </div>
      <ul className={styles.lines}>
        {lines.map((l, i) => {
          const on = voice.playing && voice.url === l.url;
          return (
            <li key={l.n}>
              <Reveal delay={i % 6}>
                <button
                  type="button"
                  className={styles.line}
                  data-on={on}
                  aria-pressed={on}
                  onClick={() => {
                    toggle(l.url);
                  }}
                >
                  <span className={styles.lineNo}>{pad(l.n)}</span>
                  <span className={styles.lineText}>
                    <b lang="ja">{l.jpTitle}</b>
                    <span>{l.en}</span>
                  </span>
                  <span className={styles.bars} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="sr-only">{on ? "Stop" : "Play"}</span>
                </button>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
