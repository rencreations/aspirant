import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";

import { REEL_POSTER } from "../media";
import styles from "./opening.module.css";
import { Title } from "./title";

/** What the series is, in the game's own facts. The last words are set in the serif. */
const LEDE =
  "The Aspirants is the anime skin series of Mobile Legends: Bang Bang. It began in January 2022 as the game's first anime-themed skins and is the first series featured in TheMLabel.";
const LEDE_END = "Five phases so far, and still running.";

const LABELS = ["TheMLabel series", "Since January 2022", "Now in Phase V"] as const;

const FIGURES = [
  { value: "10", label: "Skins" },
  { value: "5", label: "Phases" },
  { value: "4+", label: "Years" },
] as const;

/** A run of words, each rising out of its own mask, one a moment after the other. */
function Words({ text, from }: { text: string; from: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className={styles.word}>
            <span style={{ "--d": from + i } as CSSProperties}>{word}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/**
 * The first screen: the title at the very top, the drone's place at the lower left, and on the
 * right half what the series is, then the place of the reel's preview with three figures beside
 * it. The preview itself is the film (film.tsx): the box here only says where it rests.
 */
export function Hero() {
  const ledeWords = LEDE.split(" ").length;
  return (
    <div className={styles.hero}>
      <Title />

      <div className={styles.anchor} data-drone-anchor="hero" aria-hidden="true" />

      <div className={styles.copy} data-about-copy="">
        <ul className={styles.labels}>
          {LABELS.map((label, i) => (
            <li key={label} className={styles.label}>
              <span className={styles.mask}>
                <span style={{ "--d": i * 3 } as CSSProperties}>{label}</span>
              </span>
            </li>
          ))}
          <li
            className={styles.labelsRule}
            style={{ "--d": 2 } as CSSProperties}
            aria-hidden="true"
          />
        </ul>

        <div className={styles.text}>
          <p className={`${styles.eyebrow} hud-label`}>
            <span className={styles.mask}>
              <span style={{ "--d": 8 } as CSSProperties}>
                <span className={styles.eyebrowNo}>01</span> / The series
              </span>
            </span>
          </p>
          <p className={styles.lede}>
            <Words text={LEDE} from={10} />{" "}
            <em className={`${styles.ledeEnd} serif`}>
              <Words text={LEDE_END} from={10 + ledeWords} />
            </em>
          </p>
        </div>

        <div className={styles.reelRow}>
          <div className={styles.reel}>
            <p className={`${styles.caption} hud-label`}>
              <span className={styles.mask}>
                <span style={{ "--d": 34 } as CSSProperties}>The reel</span>
              </span>
              <span className={styles.mask}>
                <span style={{ "--d": 37 } as CSSProperties}>Five phases, one cut</span>
              </span>
            </p>
            {/* Where the preview rests. Without scripts the film is not placed, so its still shows here. */}
            <div
              className={styles.slot}
              data-about-slot=""
              aria-hidden="true"
              style={{ "--poster": `url("${asset(REEL_POSTER)}")` } as CSSProperties}
            />
          </div>

          <ul className={styles.figures}>
            {FIGURES.map((f, i) => (
              <li key={f.label} className={styles.figure}>
                <span
                  className={styles.figureRule}
                  style={{ "--d": 36 + i * 4 } as CSSProperties}
                  aria-hidden="true"
                />
                <span className={`${styles.figureValue} display`}>
                  <span className={styles.mask}>
                    <span style={{ "--d": 38 + i * 4 } as CSSProperties}>{f.value}</span>
                  </span>
                </span>
                <span className={`${styles.figureLabel} hud-label`}>
                  <span className={styles.mask}>
                    <span style={{ "--d": 40 + i * 4 } as CSSProperties}>{f.label}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
