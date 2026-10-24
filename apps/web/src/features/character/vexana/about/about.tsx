"use client";

import { useRef, useState } from "react";

import { getCharacter } from "@/content/characters";
import { StarGlyph } from "@/components/star-glyph";
import { asset } from "@/lib/asset";
import { useInView } from "@/lib/hooks";

import { FIGURES } from "../media";
import styles from "./about.module.css";
import { VoiceRow } from "./voice-row";

type Form = "normal" | "ender";

const c = getCharacter("vexana");

/** The playlist opens with this many lines. */
const SHOWN = 12;

/** The five notes. Each takes its first three lines from the character data. */
const NOTES = [
  { key: "personality", title: "Temper", mark: "I" },
  { key: "appearance", title: "Look", mark: "II" },
  { key: "fighting", title: "Craft", mark: "III" },
  { key: "motivation", title: "Reason", mark: "IV" },
  { key: "flaws", title: "Weight", mark: "V" },
] as const;

const FORMS: Record<Form, { label: string; tag: string }> = {
  normal: { label: "Academy form", tag: "Dark hair, violet eyes" },
  ender: { label: "Ender form", tag: "Silver hair, horns" },
};

const LEDGER: ReadonlyArray<readonly [string, string]> = [
  ["Aspirant name", c.aspirantName],
  ["Age", c.ageText],
  ["Birthday", c.birthday],
  ["Type", c.mbti],
  ["Role", c.role],
  ["Weapon", c.weapon],
  ["Partner", "Guinevere"],
];

/**
 * Who she is, without the long story: the name in two scripts, a figure that changes form, a
 * ledger of facts, five short notes and the playlist of her voice lines. Dusk colours, set as
 * an editorial spread rather than a profile card.
 */
export function About() {
  const rootRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<Form>("normal");
  const [swaps, setSwaps] = useState(0);
  const [allVoices, setAllVoices] = useState(false);
  const seen = useInView(rootRef, { rootMargin: "0px 0px -12% 0px", once: true });

  const pick = (next: Form) => {
    if (next === form) return;
    setForm(next);
    setSwaps((n) => n + 1);
  };

  return (
    <section
      ref={rootRef}
      id="about"
      className={styles.about}
      data-form={form}
      data-in={seen}
      aria-labelledby="about-title"
    >
      <div className={styles.grain} aria-hidden="true" />

      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowNo}>01</span>
          <span className={styles.eyebrowBar} aria-hidden="true" />
          <span>Registry entry</span>
        </p>
        <h2 id="about-title" className={styles.name}>
          <span className={styles.nameEcho} aria-hidden="true">
            Vexana
          </span>
          <span className={styles.nameMain}>
            <span className="sr-only">Vexana</span>
            {Array.from("Vexana").map((ch, i) => (
              <span
                key={i}
                className={styles.letter}
                style={{ ["--i" as string]: i }}
                aria-hidden="true"
              >
                {ch}
              </span>
            ))}
          </span>
        </h2>
        <p className={styles.alias}>{c.aspirantName}</p>
        <p className={styles.tagline}>{c.tagline}</p>
        <div className={styles.jp}>
          <span className={styles.jpKana} lang="ja">
            {c.jp.script}
          </span>
          <span className={styles.jpRoman}>{c.jp.romaji}</span>
          <span className={styles.jpNote}>Her father&apos;s name for her</span>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.stage}>
          <div className={styles.ring} aria-hidden="true">
            <span className={styles.ringA} />
            <span className={styles.ringB} />
            <StarGlyph className={styles.ringStar} />
          </div>
          <div className={styles.figure}>
            {(["normal", "ender"] as const).map((f) => (
              // Plain <img>: static export, cut-outs already sized.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f}
                className={styles.figureImg}
                data-on={form === f}
                src={asset(f === "normal" ? FIGURES.normalSide : FIGURES.enderSide)}
                alt={f === form ? `Vexana in her ${FORMS[f].label.toLowerCase()}` : ""}
                aria-hidden={f !== form}
                draggable={false}
                loading="lazy"
              />
            ))}
            <span key={swaps} className={styles.slash} data-run={swaps > 0} aria-hidden="true" />
          </div>
          <div className={styles.toggle} role="group" aria-label="Form">
            {(["normal", "ender"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={styles.toggleBtn}
                aria-pressed={form === f}
                data-cursor="FORM"
                onClick={() => {
                  pick(f);
                }}
              >
                <span className={styles.toggleLabel}>{FORMS[f].label}</span>
                <span className={styles.toggleTag}>{FORMS[f].tag}</span>
              </button>
            ))}
          </div>
          <p className={styles.formText} aria-live="polite">
            {c.forms?.[form]}
          </p>
        </div>

        <div className={styles.side}>
          <p className={styles.summary}>{c.summary}</p>
          <dl className={styles.ledger}>
            {LEDGER.map(([k, v], i) => (
              <div key={k} className={styles.row} style={{ ["--i" as string]: i }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <ol className={styles.notes}>
            {NOTES.map((n, i) => (
              <li key={n.key} className={styles.note} style={{ ["--i" as string]: i }}>
                <span className={styles.noteMark} aria-hidden="true">
                  {n.mark}
                </span>
                <h3 className={styles.noteTitle}>{n.title}</h3>
                <ul className={styles.noteList}>
                  {c.sections[n.key].slice(0, 3).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.voices}>
        <div className={styles.voicesHead}>
          <h3 className={styles.voicesTitle}>Hear her</h3>
          <p className={styles.voicesNote}>
            {c.voice.length} lines. One plays at a time. Press again to stop.
          </p>
        </div>
        <ul className={styles.voiceList}>
          {(allVoices ? c.voice : c.voice.slice(0, SHOWN)).map((line) => (
            <VoiceRow key={line.n} line={line} />
          ))}
        </ul>
        {c.voice.length > SHOWN ? (
          <button
            type="button"
            className={styles.more}
            aria-expanded={allVoices}
            onClick={() => {
              setAllVoices((v) => !v);
            }}
          >
            {allVoices ? "Show fewer lines" : `Show all ${c.voice.length} lines`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
