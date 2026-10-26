"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { TLink } from "@/components/transition/t-link";
import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { useInView } from "@/lib/hooks";
import { characterRoute } from "@/lib/site";
import { CONFIG } from "./config";
import styles from "./lc.module.css";
import { HERO, PARTNER, type Who } from "./media";

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
 * The open channel. A small pill that stays at the corner once the first screen has gone by and
 * leaves again at the meeting (which has its own link). It names who is on the other end and
 * leads to her page. Its four bars move while it shows and flare when you point at it.
 */
export function Channel({ who }: { who: Who }) {
  const other = PARTNER[who];
  const them = getCharacter(other);
  const [away, setAway] = useState({ top: true, end: false });

  useEffect(() => {
    const top = document.getElementById("top");
    const end = document.getElementById("together");
    if (!top) return;
    const a = new IntersectionObserver(
      ([e]) => {
        setAway((s) => ({ ...s, top: e?.isIntersecting ?? false }));
      },
      { threshold: 0.6 },
    );
    a.observe(top);
    const b = new IntersectionObserver(
      ([e]) => {
        setAway((s) => ({ ...s, end: e?.isIntersecting ?? false }));
      },
      { threshold: 0.2 },
    );
    if (end) b.observe(end);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, []);

  const shown = !away.top && !away.end;
  return (
    <TLink
      href={characterRoute(other)}
      transitionLabel={them.name}
      className={styles.channel}
      data-shown={shown}
      data-cursor="GO"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      aria-label={`Switch to ${them.name}'s page`}
    >
      <span className={styles.meter} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className={styles.chanText} aria-hidden="true">
        <small>Channel open</small>
        <b>{CONFIG[who].channel}</b>
      </span>
    </TLink>
  );
}

/** 01. Who she is: a service card (Lesley) or a lab pass (Chang'e). */
export function Profile({ who }: { who: Who }) {
  const c = getCharacter(who);
  const facts: Array<[string, string, string?]> = [
    ["Aspirant name", c.aspirantName],
    ["Age", c.ageText, c.ageNote],
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
      aria-labelledby="lc-profile"
    >
      <Head no={1} label="Profile" title={c.name} lead={CONFIG[who].profileLead} id="lc-profile" />
      <div className={styles.profileBody}>
        <Reveal className={styles.card}>
          <span
            className={styles.portrait}
            role="img"
            aria-label={`${c.name}, cropped from her official splash art`}
            style={{
              backgroundImage: `url(${asset(HERO[who].src)})`,
              backgroundPosition: HERO[who].face,
            }}
          />
          <p className={styles.jp} lang="ja">
            {c.jp.script}
          </p>
          {c.jp.romaji ? <p className={styles.romaji}>{c.jp.romaji}</p> : null}
        </Reveal>
        <div className={styles.profileText}>
          <Reveal delay={1}>
            <p className={styles.summary}>{c.summary}</p>
          </Reveal>
          <dl className={styles.facts}>
            {facts.map(([k, v, note], i) => (
              <Reveal key={k} className={styles.fact} delay={i}>
                <dt>{k}</dt>
                <dd>
                  {v}
                  {note ? <small>{note}</small> : null}
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/**
 * 02. The six notes as a deck of cards. The top card goes to the back when you move on. Buttons,
 * dots and the arrow keys all work.
 */
export function Deck({ who }: { who: Who }) {
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
  const n = groups.length;
  const [i, setI] = useState(0);
  const go = (d: number) => {
    setI((x) => (x + d + n) % n);
  };
  const onKey = (e: KeyboardEvent) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    go(step);
  };

  return (
    <section
      id="notes"
      className={styles.notes}
      data-who={who}
      data-theme="daybreak"
      aria-labelledby="lc-notes"
    >
      <Head
        no={2}
        label="Notes"
        title="Six notes"
        lead="One card at a time. The top card goes to the back."
        id="lc-notes"
      />
      <div className={styles.notesBody}>
        <div
          className={styles.deck}
          role="group"
          aria-label={`Notes on ${c.name}`}
          onKeyDown={onKey}
        >
          <div className={styles.stack}>
            {groups.map((lines, k) => {
              const o = (k - i + n) % n;
              return (
                <article
                  key={topics[k]}
                  className={styles.note}
                  data-far={o > 2}
                  aria-hidden={o !== 0}
                  style={{ "--o": o } as CSSProperties}
                >
                  <p className={styles.noteNo}>{pad(k + 1)}</p>
                  <h3>{topics[k]}</h3>
                  <ul>
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
          <div className={styles.deckBar}>
            <button
              type="button"
              className={styles.pill}
              onClick={() => {
                go(-1);
              }}
              data-cursor="BACK"
            >
              Back
            </button>
            <ol className={styles.dots}>
              {topics.map((t, k) => (
                <li key={t}>
                  <button
                    type="button"
                    aria-label={`Note ${k + 1}: ${t}`}
                    aria-current={k === i}
                    onClick={() => {
                      setI(k);
                    }}
                  />
                </li>
              ))}
            </ol>
            <button
              type="button"
              className={styles.pill}
              onClick={() => {
                go(1);
              }}
              data-cursor="NEXT"
            >
              Next
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            Note {i + 1} of {n}: {topics[i]}
          </p>
        </div>
        <span
          className={styles.tall}
          aria-hidden="true"
          style={{
            backgroundImage: `url(${asset(HERO[who].src)})`,
            backgroundPosition: HERO[who].tall,
          }}
        />
      </div>
    </section>
  );
}
