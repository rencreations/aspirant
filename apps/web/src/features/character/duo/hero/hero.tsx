"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useIsTouch, useReducedMotion } from "@/lib/hooks";
import { withSound } from "@/lib/sound-prompt";

import { crop } from "../crop";
import { RUBY_TERMINAL, TETRA_AT, type Who } from "../duo-data";
import { layerPath, splashPath } from "../duo-media";
import { useReveal } from "../use-reveal";
import styles from "./hero.module.css";
import { useHeroPointer } from "./use-hero-pointer";

export interface HeroProps {
  who: Who;
  name: string;
  aspirantName: string;
  jp: { script: string; romaji: string | null };
  tagline: string;
  role: string;
  hint: string;
  hintTouch: string;
  layerName: string;
  /** The lines Tetra reads out (Angela's page only). */
  tetra: ReadonlyArray<{ n: number; en: string; src: string }>;
}

const BEAT =
  "M0 30 H520 L540 30 L556 4 L578 56 L596 14 L610 30 H1060 L1080 30 L1096 6 L1118 54 L1136 16 L1150 30 H1600";

/** Types the terminal of Ruby's hero, a line at a time, once it is on screen. */
function Terminal({ reduced }: { reduced: boolean }) {
  const total = RUBY_TERMINAL.reduce((n, l) => n + l.cmd.length + l.out.length, 0);
  const [typed, setTyped] = useState(reduced ? total : 0);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setTyped((n) => {
        if (n >= total) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 34);
    return () => {
      window.clearInterval(id);
    };
  }, [reduced, total]);

  const starts = RUBY_TERMINAL.map((_, i) =>
    RUBY_TERMINAL.slice(0, i).reduce((n, l) => n + l.cmd.length + l.out.length, 0),
  );
  return (
    <div className={styles.terminal} aria-label="What Ruby says about herself">
      <p className={styles.termBar}>
        <span>bench / ruby.sh</span>
        <span className={styles.termDot} aria-hidden="true" />
      </p>
      {RUBY_TERMINAL.map((line, i) => {
        const t = typed - (starts[i] ?? 0);
        const cmd = line.cmd.slice(0, Math.max(0, t));
        const out = line.out.slice(0, Math.max(0, t - line.cmd.length));
        if (cmd.length === 0) return null;
        return (
          <p key={line.cmd} className={styles.termLine}>
            <span className={styles.termCmd}>{`> ${cmd}`}</span>
            {out ? <span className={styles.termOut}>{out}</span> : null}
          </p>
        );
      })}
      <span className={styles.caret} aria-hidden="true" />
    </div>
  );
}

/** Tetra, the doll-sized twin, floating by Angela's side. A press makes her say a line. */
function Tetra({ lines }: { lines: HeroProps["tetra"] }) {
  const [i, setI] = useState(0);
  const [said, setSaid] = useState(false);
  const line = lines[i % Math.max(1, lines.length)];
  if (!line) return null;
  const say = () => {
    audio.unlock();
    withSound("This voice line", () => void audio.playVoice(asset(line.src)));
    setSaid(true);
    setI((v) => (said ? v + 1 : v));
  };
  return (
    <div className={styles.tetra}>
      <p className={styles.bubble} data-on={said} aria-live="polite">
        {said ? line.en : "Press me."}
      </p>
      <button
        type="button"
        className={styles.tetraFace}
        style={crop(asset(splashPath("angela")), TETRA_AT, TETRA_AT.zoom)}
        onClick={say}
        aria-label="Tetra. Press to hear a line"
        data-cursor="HEAR"
      />
    </div>
  );
}

/**
 * The opening of each page. The splash art fills the screen. A second picture shows through a
 * circle that follows the pointer: Ruby's is the art as a blueprint (drawn in cyan and gold on
 * navy), Angela's is the art as a warmth map. Ruby's has a terminal and a scan line, Angela's has
 * a heartbeat, a halo and Tetra.
 */
export function Hero({
  who,
  name,
  aspirantName,
  jp,
  tagline,
  role,
  hint,
  hintTouch,
  layerName,
  tetra,
}: HeroProps) {
  const reduced = useReducedMotion();
  const touch = useIsTouch();
  const root = useReveal<HTMLElement>("0px");
  const { host, layer, mark } = useHeroPointer({ reduced, flood: who === "angela" });

  const letters = name.toUpperCase().split("");
  return (
    <header ref={root} className={styles.hero} data-who={who} aria-labelledby={`${who}-name`}>
      <div ref={host} className={styles.stage}>
        {/* Plain <img>: static export, art already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.art}
          src={asset(splashPath(who))}
          alt={`${name}, official splash art`}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={layer}
          className={styles.layer}
          src={asset(layerPath(who))}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <div className={styles.scrim} aria-hidden="true" />
        <div ref={mark} className={styles.markWrap} aria-hidden="true">
          <span className={styles.mark} />
          <span className={styles.markName}>{layerName}</span>
        </div>

        {who === "ruby" ? (
          <>
            <span className={`${styles.bracket} ${styles.tl}`} aria-hidden="true" />
            <span className={`${styles.bracket} ${styles.tr}`} aria-hidden="true" />
            <span className={`${styles.bracket} ${styles.bl}`} aria-hidden="true" />
            <span className={`${styles.bracket} ${styles.br}`} aria-hidden="true" />
            <span className={styles.scan} aria-hidden="true" />
            <Terminal reduced={reduced} />
          </>
        ) : (
          <>
            <svg className={styles.beat} viewBox="0 0 1600 60" aria-hidden="true">
              <path className={styles.beatBase} pathLength={1} d={BEAT} />
              <path className={styles.beatLine} pathLength={1} d={BEAT} />
            </svg>
            <p className={styles.tick} aria-hidden="true">
              カチ、カチ、カチ
            </p>
            <Tetra lines={tetra} />
          </>
        )}

        <div className={styles.text}>
          <p className={styles.eyebrow}>
            <span>{aspirantName}</span>
            <span aria-hidden="true">/</span>
            <span>{role}</span>
          </p>
          <h1 id={`${who}-name`} className={styles.name} aria-label={name}>
            {letters.map((ch, n) => (
              <span
                key={n}
                className={styles.letter}
                style={{ "--i": n } as CSSProperties}
                aria-hidden="true"
              >
                {ch}
              </span>
            ))}
          </h1>
          <p className={styles.jp} lang="ja">
            <span>{jp.script}</span>
            {jp.romaji ? <span className={styles.romaji}>{jp.romaji}</span> : null}
          </p>
          <p className={styles.tagline}>{tagline}</p>
          <p className={styles.hint}>{touch ? hintTouch : hint}</p>
        </div>

        <p className={styles.cue} aria-hidden="true">
          <span>Scroll</span>
          <span className={styles.cueLine} />
        </p>
      </div>
    </header>
  );
}
