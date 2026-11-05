"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";

import { asset } from "@/lib/asset";

import { Compilation } from "./compilation";
import { LineRow } from "./line-row";
import { totalLength } from "./logic";
import type { VoiceCharacter, VoiceItem, VoiceLang } from "./types";
import styles from "./voicelines.module.css";

interface PanelProps {
  character: VoiceCharacter;
  index: number;
  lines: readonly VoiceItem[];
  compilation: VoiceItem | undefined;
  lang: VoiceLang;
  playingId: string | null;
  targetId: string | null;
  /** True when a search is narrowing the list. */
  searching: boolean;
  onToggle: (item: VoiceItem) => void;
}

/** Marks an element once it first comes into view, so its reveal runs once. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.in = "true";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);
  return ref;
}

/** One character: a big splash backdrop with the name, the full compilation, and every line. */
export const CharacterPanel = memo(function CharacterPanel({
  character: c,
  index,
  lines,
  compilation,
  lang,
  playingId,
  targetId,
  searching,
  onToggle,
}: PanelProps) {
  const head = useReveal<HTMLElement>();
  const style = {
    "--accent": c.palette.primary,
    "--accent-ink": c.palette.ink,
    "--accent-2": c.palette.secondary,
  } as CSSProperties;

  return (
    <section
      id={`vl-${c.slug}`}
      className={styles.panel}
      style={style}
      aria-labelledby={`vl-${c.slug}-h`}
      data-slug={c.slug}
    >
      <header ref={head} className={styles.phead}>
        <div className={styles.splashWrap} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.splash}
            src={asset(c.splash)}
            alt=""
            width={800}
            height={450}
            decoding="async"
            loading={index < 2 ? "eager" : "lazy"}
          />
        </div>
        <div className={styles.pmain}>
          <p className={`${styles.pindex} hud-label`}>
            {String(index + 1).padStart(2, "0")} / {c.aspirant}
          </p>
          <h2 id={`vl-${c.slug}-h`} className={`${styles.pname} display`}>
            {c.name}
          </h2>
          <p className={styles.pjp} lang="ja">
            {c.jp}
            {c.romaji ? <span> {c.romaji}</span> : null}
          </p>
          <p className={`${styles.pstats} hud-label`}>
            <span className={styles.pcount}>
              {searching ? `${lines.length} of ${c.lines}` : c.lines}
            </span>{" "}
            lines
            <span className={styles.dot} aria-hidden="true" />
            {totalLength(c.dur)}
          </p>
          {compilation ? <Compilation item={compilation} name={c.name} lines={c.lines} /> : null}
        </div>
      </header>
      <ol className={styles.lines}>
        {lines.map((item) => (
          <LineRow
            key={item.id}
            item={item}
            name={c.name}
            lang={lang}
            playing={playingId === item.id}
            target={targetId === item.id}
            onToggle={onToggle}
          />
        ))}
      </ol>
    </section>
  );
});
