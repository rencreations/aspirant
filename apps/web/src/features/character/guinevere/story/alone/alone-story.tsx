"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { HERO, artThumb } from "../../media";
import { useActiveSection } from "../active";
import shared from "../shared.module.css";
import { ENTRIES, type Entry } from "./alone-data";
import { DoodleArt } from "./doodles";
import styles from "./alone.module.css";

const IDS = ENTRIES.map((e) => e.id);

/** A word of the title, its letters rising when the hero is in view. */
function Rise({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <span className={styles.line} aria-hidden="true">
      {[...text].map((c, i) => (
        <span key={i} className={styles.ch} style={{ "--i": from + i } as CSSProperties}>
          {c}
        </span>
      ))}
    </span>
  );
}

function EntryView({ entry, index }: { entry: Entry; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const seen = useInView(ref, { threshold: 0.18, once: true });
  const side = index % 2 === 0 ? "left" : "right";
  return (
    <article
      id={entry.id}
      ref={ref}
      className={styles.entry}
      data-in={seen || reduced}
      data-side={side}
      aria-labelledby={`${entry.id}-title`}
    >
      <div className={styles.sheet}>
        <header className={styles.meta}>
          <span className={styles.no} aria-hidden="true">
            {entry.no}
          </span>
          <p className={styles.stamp}>{entry.stamp}</p>
          <DoodleArt kind={entry.doodle} className={styles.doodle} />
        </header>
        <div className={styles.body}>
          <h2 id={`${entry.id}-title`} className={styles.title}>
            {entry.title}
          </h2>
          {entry.text.map((t, i) => (
            <p key={i} className={styles.p} style={{ "--p": i } as CSSProperties}>
              {t}
            </p>
          ))}
          {entry.exchange ? (
            <ul className={styles.exchange}>
              {entry.exchange.map((line, i) => (
                <li key={i} style={{ "--p": i + entry.text.length } as CSSProperties}>
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {entry.art ? (
          <figure className={styles.polaroid}>
            {/* Plain <img>: static export, art already sized. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(artThumb(entry.art.name))}
              alt={entry.art.alt}
              width={960}
              height={540}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={styles.tape} aria-hidden="true" />
          </figure>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Part one. A notebook on a desk: seven ledger pages, one entry each, and the sky behind the desk
 * goes from morning to night as you read, until a small gold light is the only one left.
 * The only things written per scroll are the opacity of two sky layers and the light.
 */
export function AloneStory() {
  const reduced = useReducedMotion();
  const lenis = useLenis();
  const root = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const lamp = useRef<HTMLDivElement>(null);
  const seen = useInView(hero, { threshold: 0.35, once: true });
  const active = useActiveSection(IDS);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
      if (night.current) night.current.style.opacity = String((p ** 1.15).toFixed(3));
      if (lamp.current)
        lamp.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.5) * 2.4)).toFixed(3));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div ref={root} className={styles.root}>
      <div className={styles.sky} aria-hidden="true">
        <div className={styles.dawn} />
        <div ref={night} className={styles.night} />
        <div ref={lamp} className={styles.lamp} />
      </div>

      <header
        ref={hero}
        className={styles.hero}
        data-in={seen || reduced}
        aria-labelledby="alone-title"
      >
        <div className={styles.heroText}>
          <p className={styles.kicker}>Part one of two</p>
          <h1 id="alone-title" className={styles.h1}>
            <span className={shared.sr}>Alone</span>
            <Rise text="ALONE" />
          </h1>
          <p className={styles.lede}>
            A house with two hundred and forty windows, and one girl who counted them. Her half of
            the story, up to the day somebody called her strong.
          </p>
          <p className={styles.sign} aria-hidden="true">
            <span className={styles.signInk}>Guin</span>
            <span className={styles.signJp}>グィネヴィア</span>
          </p>
          <p className={styles.warn}>
            Spoilers: this page is the story, and it gives away how her half ends.
          </p>
          <a
            className={styles.cue}
            href={`#${ENTRIES[0]!.id}`}
            onClick={(e) => {
              e.preventDefault();
              lenis.scrollTo(`#${ENTRIES[0]!.id}`, { offset: -120 });
            }}
          >
            <span>Turn the page</span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 5v14m-6-6 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </a>
        </div>
        {/* Plain <img>: static export, a transparent cut-out. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.figure}
          src={asset(HERO.front)}
          alt="Guinevere, smiling at you, with her cat-eared headband and a red tie."
          width={1672}
          height={941}
          draggable={false}
        />
      </header>

      <ol className={styles.rail} data-show={active >= 0} aria-label="Pages of part one">
        {ENTRIES.map((e, i) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className={styles.dot}
              aria-current={i === active ? "step" : undefined}
              aria-label={`Page ${e.no}: ${e.title}`}
              onClick={(ev) => {
                ev.preventDefault();
                lenis.scrollTo(`#${e.id}`, { offset: -120 });
              }}
            >
              <span>{e.no}</span>
            </a>
          </li>
        ))}
      </ol>

      <div className={styles.ledger}>
        {ENTRIES.map((e, i) => (
          <EntryView key={e.id} entry={e} index={i} />
        ))}
      </div>

      <p className={styles.end}>Someone has said it. The star at her collar is not made yet.</p>
    </div>
  );
}
