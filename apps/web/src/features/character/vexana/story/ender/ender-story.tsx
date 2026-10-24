"use client";

import { useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { FIGURES, artThumb } from "../../media";
import { useActiveSection } from "../active";
import { Resolve } from "../resolve";
import shared from "../shared.module.css";
import { LOGS, type Line, type Log, type Voice } from "./ender-data";
import styles from "./ender.module.css";

const IDS = LOGS.map((l) => l.id);

const WHO: Record<Voice, string> = {
  log: "Log",
  vexana: "Vexana",
  will: "The Will",
  guinevere: "Guinevere",
  obsidia: "Obsidia",
  selena: "Selena",
};

/** The Emblem of Hope: the one light on the page. How it burns follows the entry being read. */
function Emblem() {
  return (
    <span className={styles.emblem} aria-hidden="true">
      <span className={styles.ring} />
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <path
          d="M32 2 38 26 62 32 38 38 32 62 26 38 2 32 26 26Z"
          fill="currentColor"
          stroke="rgb(20 10 40 / 0.5)"
          strokeWidth="1"
        />
        <path d="M32 14 35 29 50 32 35 35 32 50 29 35 14 32 29 29Z" fill="#fff6d6" />
      </svg>
    </span>
  );
}

function LineView({ line, index }: { line: Line; index: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const seen = useInView(ref, { threshold: 0.5, rootMargin: "0px 0px -8% 0px", once: true });
  return (
    <p ref={ref} className={styles.line} data-voice={line.voice} data-in={seen || reduced}>
      <span className={styles.who} aria-hidden="true">
        {WHO[line.voice]}
      </span>
      <span className={styles.said}>
        <Resolve text={line.text} on={seen} delay={(index % 3) * 60} />
      </span>
    </p>
  );
}

function LogView({ log, index, total }: { log: Log; index: number; total: number }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const seen = useInView(ref, { threshold: 0.12, once: true });
  return (
    <section
      id={log.id}
      ref={ref}
      className={styles.log}
      data-in={seen || reduced}
      data-light={log.light}
      aria-labelledby={`${log.id}-title`}
    >
      <header className={styles.head}>
        <p className={styles.code}>
          Log {log.no} of {String(total).padStart(2, "0")}
        </p>
        <h2 id={`${log.id}-title`} className={styles.title} data-text={log.title}>
          {log.title}
        </h2>
        <p className={styles.stamp}>{log.stamp}</p>
        <p className={styles.chip}>
          <span className={styles.pip} aria-hidden="true" />
          Link: {log.signal}
        </p>
      </header>
      <div className={styles.lines}>
        {log.art ? (
          <figure className={styles.shard}>
            {/* Plain <img>: static export, art already sized. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(artThumb(log.art.name))}
              alt={log.art.alt}
              width={960}
              height={540}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </figure>
        ) : null}
        {log.lines.map((l, i) => (
          <LineView key={i} line={l} index={i + index} />
        ))}
      </div>
    </section>
  );
}

/**
 * Part two. A transmission log recovered from the dark: eight entries, each line arriving
 * corrupted and settling as you reach it. The Emblem of Hope in the corner is the only warm thing
 * on the page, and it burns brighter or fainter with the entry. The last entry restores the link.
 */
export function EnderStory() {
  const reduced = useReducedMotion();
  const lenis = useLenis();
  const hero = useRef<HTMLElement>(null);
  const seen = useInView(hero, { threshold: 0.35, once: true });
  const active = useActiveSection(IDS);
  const current = active >= 0 ? LOGS[active] : undefined;
  const last = LOGS.length - 1;

  return (
    <div
      className={styles.root}
      data-light={current?.light ?? "dim"}
      data-restored={active === last}
      data-exec={current?.id === "execute"}
    >
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.grid} />
        <div className={styles.glow} />
        <div className={styles.warm} />
        <div className={styles.flash} />
        <div className={styles.scan} />
      </div>

      <div className={styles.hud} data-show={active >= 0} aria-hidden="true">
        <p>
          {current ? `Log ${current.no}` : "Log"}{" "}
          <span>/ {String(LOGS.length).padStart(2, "0")}</span>
        </p>
        <p>Link: {current?.signal ?? "None"}</p>
      </div>
      <div className={styles.light} data-light={current?.light ?? "dim"}>
        <Emblem />
      </div>

      <header
        ref={hero}
        className={styles.hero}
        data-in={seen || reduced}
        aria-labelledby="ender-title"
      >
        <div className={styles.heroText}>
          <p className={styles.kicker}>Transmission 02 of 02</p>
          <h1 id="ender-title" className={styles.h1} data-text="ENDER">
            <span className={shared.sr}>Ender</span>
            <span aria-hidden="true" className={styles.h1Face} data-text="ENDER">
              ENDER
            </span>
          </h1>
          <p className={styles.lede}>
            The black gate, the void, and a lie told for love. Her half of the story, from the night
            the Enders took her.
          </p>
          <p className={styles.warn}>
            Spoilers: this page is the story. It ends where the story stops, with nothing settled.
          </p>
          <a
            className={styles.cue}
            href={`#${LOGS[0]!.id}`}
            onClick={(e) => {
              e.preventDefault();
              lenis.scrollTo(`#${LOGS[0]!.id}`, { offset: -140 });
            }}
          >
            <span>Open the log</span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 5v14m-6-6 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </a>
        </div>
        {/* Plain <img>: static export, a transparent cut-out. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.figure}
          src={asset(FIGURES.enderFront)}
          alt="Vexana in her Ender form, with horns, silver-lavender hair and glowing pink eyes."
          width={1672}
          height={941}
          draggable={false}
        />
      </header>

      <div className={styles.logs}>
        {LOGS.map((l, i) => (
          <LogView key={l.id} log={l} index={i} total={LOGS.length} />
        ))}
      </div>

      <p className={styles.end}>
        The Matrix is still above Terrinia. What happens next is not written yet.
      </p>
    </div>
  );
}
