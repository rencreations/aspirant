"use client";

import { useState } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { crop } from "../crop";
import { DUET, FACE, NAMES, type Who } from "../duo-data";
import { splashPath } from "../duo-media";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./duet.module.css";

/**
 * "Does it hurt?" The exchange of the trailer, one beat at a time. Both pages carry it, because
 * it belongs to both: the night half is Ruby's, the morning half is Angela's, and the visitor
 * stands on the side of the page they came by. Each press sends the next line; a pulse runs along
 * the tether from the one who spoke to the one who hears, and the line lands as a bubble.
 */
export function Duet({ who }: { who: Who }) {
  const ref = useReveal<HTMLElement>();
  const [step, setStep] = useState(0);
  const done = step >= DUET.length;
  const last = DUET[step - 1];

  const advance = () => {
    audio.blip(done ? "click" : "confirm");
    setStep(done ? 0 : step + 1);
  };

  const portrait = (w: Who) => (
    <div
      className={styles.portrait}
      data-who={w}
      data-speaking={last?.who === w}
      data-you={w === who}
    >
      <span
        className={styles.face}
        style={crop(asset(splashPath(w)), FACE[w], FACE[w].zoom)}
        aria-hidden="true"
      />
      <span className={styles.name}>{NAMES[w]}</span>
      {w === who ? <span className={styles.you}>You came by here</span> : null}
    </div>
  );

  return (
    <section ref={ref} className={styles.section} data-who={who} aria-labelledby={`${who}-duet`}>
      <div className={styles.halves} aria-hidden="true">
        <span className={styles.night} />
        <span className={styles.morning} />
      </div>
      <div className={styles.inner}>
        <Head id={`${who}-duet`} index="05" label="The link" title="Does it hurt?">
          Six lines from the day of the Breach. Press to send the next one.
        </Head>
        <div className={styles.stage} data-reveal>
          {portrait("ruby")}
          <div className={styles.middle}>
            <div className={styles.tether} aria-hidden="true">
              <span className={styles.wire} />
              {last ? <span key={step} className={styles.pulse} data-from={last.who} /> : null}
            </div>
            <ol className={styles.chat} aria-live="polite" aria-label="The exchange so far">
              {DUET.slice(0, step).map((beat, i) => (
                <li key={`${i}-${beat.text}`} className={styles.bubble} data-who={beat.who}>
                  <span className={styles.who}>{NAMES[beat.who]}</span>
                  {beat.text}
                </li>
              ))}
              {step === 0 ? <li className={styles.empty}>Nobody has spoken yet.</li> : null}
            </ol>
            <button type="button" className={styles.send} onClick={advance} data-cursor="SEND">
              {done ? "Again" : step === 0 ? "Ask" : "Next line"}
            </button>
          </div>
          {portrait("angela")}
        </div>
      </div>
    </section>
  );
}
