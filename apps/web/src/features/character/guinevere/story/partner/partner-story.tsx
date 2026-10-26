"use client";

import { useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { artThumb } from "../../media";
import { useActiveSection } from "../active";
import { Resolve } from "../resolve";
import shared from "../shared.module.css";
import { LOGS, type Line, type Log, type Voice } from "./partner-data";
import styles from "./partner.module.css";

const IDS = LOGS.map((l) => l.id);

const WHO: Record<Voice, string> = {
  log: "Note",
  guinevere: "Guinevere",
  vexana: "Vexana",
  harlan: "Harlan",
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
          stroke="rgb(40 24 10 / 0.5)"
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
          Entry {log.no} of {String(total).padStart(2, "0")}
        </p>
        <h2 id={`${log.id}-title`} className={styles.title} data-text={log.title}>
          {log.title}
        </h2>
        <p className={styles.stamp}>{log.stamp}</p>
        <p className={styles.chip}>
          <span className={styles.pip} aria-hidden="true" />
          Sync: {log.signal}
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
 * Part two. The file the Emblem of Hope kept: eight entries, each line arriving unsteady and
 * settling as you reach it. The Emblem in the corner is the one light on the page, and it burns
 * brighter or fainter with how in step the two stars are. The last entry restores the sync.
 */
export function PartnerStory() {
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
          {current ? `Entry ${current.no}` : "Entry"}{" "}
          <span>/ {String(LOGS.length).padStart(2, "0")}</span>
        </p>
        <p>Sync: {current?.signal ?? "None"}</p>
      </div>
      <div className={styles.light} data-light={current?.light ?? "dim"}>
        <Emblem />
      </div>

      <header
        ref={hero}
        className={styles.hero}
        data-in={seen || reduced}
        aria-labelledby="partner-title"
      >
        <div className={styles.heroText}>
          <p className={styles.kicker}>Part two of two</p>
          <h1 id="partner-title" className={styles.h1} data-text="PARTNER">
            <span className={shared.sr}>Partner</span>
            <span aria-hidden="true" className={styles.h1Face} data-text="PARTNER">
              PARTNER
            </span>
          </h1>
          <p className={styles.lede}>
            A doughnut, a gold star made by hand and a hand she almost held on to. Her half of the
            story, from the cupboard to the black hole and back.
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
            <span>Open the file</span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 5v14m-6-6 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </a>
        </div>
        {/* Plain <img>: static export, a transparent cut-out. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.figure}
          src={asset("/img/guinevere/hero/glow.webp")}
          alt="Guinevere in the light of the first morning, her hair gold."
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
        The net is still over Terrinia. What happens next is not written yet.
      </p>
    </div>
  );
}
