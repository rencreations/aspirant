"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { getCharacter } from "@/content/characters";
import { useInView } from "@/lib/hooks";
import { CONFIG } from "./config";
import styles from "./lf.module.css";
import type { Who } from "./media";

const pad = (n: number) => String(n).padStart(2, "0");

/** Fades and lifts its children in the first time it is seen. `delay` is in steps of 70 ms. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { rootMargin: "0px 0px -8% 0px", once: true });
  return (
    <div
      ref={ref}
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      data-in={seen}
      style={{ "--d": delay } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** The heading every section opens with: a number, a rule and a title. */
export function Head({
  no,
  label,
  title,
  lead,
  id,
}: {
  no: number;
  label: string;
  title: string;
  lead?: string;
  id: string;
}) {
  return (
    <header className={styles.head}>
      <p className={styles.eyebrow}>
        <span>{pad(no)}</span>
        <i aria-hidden="true" />
        <span>{label}</span>
      </p>
      <h2 id={id} className={styles.h2}>
        {title}
      </h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </header>
  );
}

/**
 * The line down the side of the page. It fills as the page is read, in the pair's two ways:
 * Layla's beam charges from the top, Fanny's cable climbs from the bottom. One element's
 * transform changes per frame and the number changes only when it rounds to a new value.
 */
export function Rail({ who }: { who: Who }) {
  const fill = useRef<HTMLSpanElement>(null);
  const num = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    let last = -1;
    const paint = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      if (fill.current) fill.current.style.transform = `scaleY(${p})`;
      const n = Math.round(p * 100);
      if (n !== last && num.current) {
        last = n;
        num.current.textContent = String(n);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={styles.rail} data-who={who} aria-hidden="true">
      <span className={styles.track}>
        <span ref={fill} className={styles.fill} />
      </span>
      <span className={styles.railLabel}>
        <b ref={num}>0</b>% {CONFIG[who].railLabel}
      </span>
    </div>
  );
}

/** 01. Who she is, as a board (Layla) or a ruled page of the drill-book (Fanny). */
export function Profile({ who }: { who: Who }) {
  const c = getCharacter(who);
  const facts: Array<[string, string]> = [
    ["Aspirant name", c.aspirantName],
    ["Age", c.ageText],
    ["Birthday", c.birthday],
    ["Type", c.mbti],
    ["Role", c.role],
    ["Weapon", c.weapon],
  ];
  return (
    <section
      id="profile"
      className={styles.profile}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lf-profile"
    >
      <Head no={1} label="Profile" title={c.name} lead={CONFIG[who].profileLead} id="lf-profile" />
      <div className={styles.profileBody}>
        <Reveal className={styles.names}>
          <p className={styles.jp} lang="ja">
            {c.jp.script}
          </p>
          <p className={styles.romaji}>{c.jp.romaji}</p>
        </Reveal>
        <Reveal className={styles.summary} delay={1}>
          <p>{c.summary}</p>
        </Reveal>
        <dl className={styles.facts}>
          {facts.map(([k, v], i) => (
            <Reveal key={k} className={styles.fact} delay={i}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** 02. The six notes as tabs: one at a time, each line arriving on its own. */
export function Notes({ who }: { who: Who }) {
  const c = getCharacter(who);
  const topics = CONFIG[who].topics;
  const groups = [
    c.sections.personality,
    c.sections.appearance,
    c.sections.fighting,
    c.sections.background,
    c.sections.motivation,
    c.sections.flaws,
  ];
  const [tab, setTab] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (tab + step + groups.length) % groups.length;
    setTab(next);
    tabs.current[next]?.focus();
  };

  return (
    <section
      id="notes"
      className={styles.notes}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lf-notes"
    >
      <Head no={2} label="Notes" title="Six notes" id="lf-notes" />
      <div className={styles.notesBody}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label={`Notes on ${c.name}`}
          onKeyDown={onKey}
        >
          {topics.map((t, i) => (
            <button
              key={t}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`lf-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={tab === i}
              aria-controls="lf-panel"
              tabIndex={tab === i ? 0 : -1}
              className={styles.tab}
              data-cursor="OPEN"
              onClick={() => {
                setTab(i);
              }}
            >
              <span>{pad(i + 1)}</span>
              {t}
            </button>
          ))}
        </div>
        <div
          id="lf-panel"
          role="tabpanel"
          aria-labelledby={`lf-tab-${tab}`}
          className={styles.panel}
        >
          <h3 key={`h${tab}`} className={styles.panelTitle}>
            {topics[tab]}
          </h3>
          <ul key={tab} className={styles.points}>
            {(groups[tab] ?? []).map((line, i) => (
              <li key={line} style={{ "--i": i } as CSSProperties}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
