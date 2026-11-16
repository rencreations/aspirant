"use client";

import { useEffect, type CSSProperties, type RefObject } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import {
  PHASES,
  TIMELINE_YEARS,
  saleMonth,
  timelineAt,
  type Phase,
  type PhaseSkin,
} from "../content";

import { useArrive } from "./arrive";
import kit from "./kit.module.css";
import styles from "./phases.module.css";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Which of a phase's two windows hangs lower, phase by phase. With the side of the art, which
 * changes every time, it gives five different pairs. The pocket it leaves under the higher window
 * is the drone's second place in the phase.
 */
const LOWER: readonly number[] = [1, 0, 0, 1, 1];

const i = (n: number) => ({ "--i": n }) as CSSProperties;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * What follows the scroll in the phases, in one listener folded into one frame: the parts on
 * screen are read first, then written, with transform only.
 *
 * - A picture drifts a little against its window, the second of a pair more than the first, so
 *   the two sit at different depths.
 * - A numeral fills with ink from its foot as it comes up the screen: empty when its top edge
 *   enters at the foot, full before it reaches the middle. The ink is in two boxes that slide
 *   against each other, so the figures stand still while their edge climbs.
 *
 * The elements that are written have no transition of their own.
 */
function useScrollParts(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    interface Part {
      frame: HTMLElement;
      draw: (box: DOMRect, vh: number) => void;
    }
    const parts: Part[] = [];
    // The last value written to each element: an unchanged one is not written again.
    const written = new WeakMap<HTMLElement, string>();
    const put = (target: HTMLElement, value: string) => {
      if (written.get(target) === value) return;
      written.set(target, value);
      target.style.transform = value;
    };

    for (const part of el.querySelectorAll<HTMLElement>("[data-drift]")) {
      const frame = part.closest<HTMLElement>("[data-window]");
      const amount = Number(part.dataset.drift) || 0;
      if (!frame) continue;
      parts.push({
        frame,
        draw: (box, vh) => {
          const p = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2);
          const y = -Math.min(1, Math.max(-1, p)) * amount * box.height;
          put(part, `translate3d(0, ${y.toFixed(1)}px, 0)`);
        },
      });
    }
    for (const frame of el.querySelectorAll<HTMLElement>("[data-fill]")) {
      const outer = frame.querySelector<HTMLElement>("[data-fill-box]");
      const inner = frame.querySelector<HTMLElement>("[data-fill-ink]");
      if (!outer || !inner) continue;
      parts.push({
        frame,
        draw: (box, vh) => {
          const left = (1 - clamp01((vh * 0.94 - box.top) / (vh * 0.5))) * 101;
          put(outer, `translate3d(0, ${left.toFixed(2)}%, 0)`);
          put(inner, `translate3d(0, ${(-left).toFixed(2)}%, 0)`);
        },
      });
    }

    const seen = new Set<Part>();
    let raf = 0;
    const draw = () => {
      raf = 0;
      const vh = window.innerHeight;
      const boxes = Array.from(seen, (part) => ({ part, box: part.frame.getBoundingClientRect() }));
      for (const { part, box } of boxes) part.draw(box, vh);
    };
    const ask = () => {
      if (!raf && seen.size > 0) raf = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          for (const part of parts) {
            if (part.frame !== entry.target) continue;
            if (entry.isIntersecting) seen.add(part);
            else {
              // One last time, so a part that left in one jump is not kept half way.
              part.draw(entry.boundingClientRect, window.innerHeight);
              seen.delete(part);
            }
          }
        }
        ask();
      },
      { rootMargin: "10% 0px 10% 0px" },
    );
    for (const frame of new Set(parts.map((part) => part.frame))) observer.observe(frame);
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", ask);
      window.removeEventListener("resize", ask);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [root]);
}

/**
 * The timeline a phase hangs from: the five years as a hairline, a run of ink up to the day the
 * phase went on sale, and all five sale days as marks, this one in the accent with its date.
 */
function Ruler({ phase }: { phase: Phase }) {
  const at = timelineAt(phase);
  const date = `${phase.sale.day} ${MONTHS_SHORT[phase.sale.month - 1] ?? ""} ${phase.sale.year}`;
  return (
    <div className={styles.ruler} data-in="false" aria-hidden="true">
      <span className={styles.track} />
      <span className={styles.run} style={{ "--at": at } as CSSProperties} />
      {TIMELINE_YEARS.map((year, k) => (
        <span
          key={year}
          className={styles.year}
          data-past={year <= phase.sale.year}
          style={{ left: `${(k / TIMELINE_YEARS.length) * 100}%`, ...i(k) }}
        >
          {year}
        </span>
      ))}
      {PHASES.filter((other) => other.n !== phase.n).map((other) => (
        <span
          key={other.n}
          className={styles.mark}
          data-past={other.n < phase.n}
          style={{ left: `${timelineAt(other) * 100}%` }}
        />
      ))}
      <span
        className={styles.pin}
        data-edge={at < 0.12 ? "start" : at > 0.88 ? "end" : "mid"}
        style={{ left: `${at * 100}%` }}
      >
        <span className={styles.pinDot} />
        <span className={styles.pinDate}>{date}</span>
      </span>
    </div>
  );
}

/** One skin of a phase: its splash art in a tall window, and its name, which opens its page. */
function SkinCard({ skin, order, slot }: { skin: PhaseSkin; order: number; slot: number }) {
  return (
    <TLink href={skin.href} className={styles.card} transitionLabel={skin.name} style={i(slot)}>
      <span className={styles.window} data-window="">
        <span className={styles.shutter}>
          <span className={styles.shutterIn}>
            <span className={styles.zoom}>
              <span className={styles.drift} data-drift={slot === 0 ? 0.045 : 0.085}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.picture}
                  src={asset(skin.picture)}
                  width={2048}
                  height={1152}
                  alt={`The official splash art of ${skin.name}, ${skin.title}`}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{ objectPosition: `${skin.focus[0]}% ${skin.focus[1]}%` }}
                />
              </span>
            </span>
          </span>
        </span>
      </span>
      <span className={styles.caption}>
        <span className={styles.captionRule} aria-hidden="true" />
        <span className={styles.index} aria-hidden="true">
          {String(order).padStart(2, "0")} / 10
        </span>
        <span className={kit.mask}>
          <span className={`display ${kit.line} ${styles.name}`}>{skin.name}</span>
        </span>
        <span className={`serif ${styles.skinTitle} ${kit.rise}`}>{skin.title}</span>
        <span className={styles.go} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
            <path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5" />
          </svg>
        </span>
      </span>
    </TLink>
  );
}

function PhaseBlock({ phase, index }: { phase: Phase; index: number }) {
  const flip = index % 2 === 1;
  const lower = LOWER[index] ?? 1;
  return (
    <li className={styles.phase} data-flip={flip} data-phase={phase.n}>
      <Ruler phase={phase} />

      <div className={styles.top} data-in="false">
        <h3 className={styles.numeral} data-fill="">
          <span className="sr-only">
            Aspirant {phase.numeral}, {phase.label}
          </span>
          <span className={`display ${styles.ghost}`} aria-hidden="true">
            {phase.numeral}
          </span>
          <span className={styles.fillBox} data-fill-box="" aria-hidden="true">
            <span className={`display ${styles.fill}`} data-fill-ink="">
              {phase.numeral}
            </span>
          </span>
        </h3>
        <div className={styles.side}>
          <p className={`${styles.tag} ${kit.rise}`}>
            <b>{phase.label}</b>
            <span>On sale</span>
            <span>{saleMonth(phase)}</span>
          </p>
          <div
            className={`${kit.anchor} ${styles.anchor}`}
            aria-hidden="true"
            data-drone-anchor={`phase-${phase.n}`}
            data-drone-face={phase.face}
            data-drone-turn={flip ? -22 : 22}
          />
        </div>
      </div>

      <dl className={styles.rows} data-in="false">
        <div className={styles.row} style={i(0)}>
          <dt>Draw event</dt>
          <dd className={kit.rise} style={i(1)}>
            {phase.event}
          </dd>
        </div>
        <div className={styles.row} style={i(1)}>
          <dt>{phase.films.length === 1 ? "Film" : "Films"}</dt>
          <dd className={kit.rise} style={i(2)}>
            {phase.films.map((film) => (
              <span key={film} className={styles.item}>
                {film}
              </span>
            ))}
          </dd>
        </div>
        <div className={styles.row} style={i(2)}>
          <dt>Music</dt>
          <dd className={kit.rise} style={i(3)}>
            {phase.music.map((ep) => (
              <span key={ep.ep} className={styles.item}>
                <span className={styles.ep}>{ep.ep}</span>
                {ep.title ? ` ${ep.title}` : null}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <div className={styles.art}>
        {phase.skins.map((skin, slot) => (
          <div
            key={skin.slug}
            className={styles.slot}
            data-in="false"
            data-in-at="20"
            data-lower={slot === lower}
          >
            <SkinCard skin={skin} order={index * 2 + slot + 1} slot={slot} />
            {slot === lower ? null : (
              <div
                className={`${kit.anchor} ${styles.pocket}`}
                aria-hidden="true"
                data-drone-anchor={`phase-${phase.n}-art`}
              />
            )}
          </div>
        ))}
      </div>
    </li>
  );
}

/**
 * The five phases, "Aspirant 1.0" to "5.0": one to a screen or nearly, each hanging from the
 * timeline of the years. The numeral is the owner's and the players' wording, the small label
 * beside it the official one. The side of the art changes from phase to phase.
 *
 * The drone has a place beside the head, one beside each numeral, and one in the pocket under the
 * higher window of each pair. They are close enough that it is always with what is on screen and
 * never has to wait at the top of the screen over a line of text.
 */
export function Phases() {
  const ref = useArrive<HTMLElement>();
  useScrollParts(ref);

  return (
    <section
      ref={ref}
      className={`${kit.section} ${styles.phases}`}
      data-about-section="phases"
      aria-labelledby="about-phases"
    >
      <div className={kit.inner}>
        <header className={styles.head} data-in="false">
          <div>
            <p className={kit.eyebrow}>
              <b>03</b>
              <span>The phases</span>
              <span className={kit.eyebrowRule} aria-hidden="true" />
              <span>2022 to 2026</span>
            </p>
            <h2 id="about-phases" className={`display ${kit.title}`}>
              <span className={kit.mask}>
                <span className={kit.line}>From 1.0 </span>
              </span>
              <span className={kit.mask}>
                <span className={kit.line} style={i(1)}>
                  to 5.0
                </span>
              </span>
            </h2>
          </div>
          <div className={styles.aside}>
            <div
              className={`${kit.anchor} ${styles.headAnchor}`}
              aria-hidden="true"
              data-drone-anchor="phases"
              data-drone-turn={-26}
            />
            <p className={`serif ${kit.lead} ${kit.rise}`} style={i(4)}>
              Officially, each release is a Phase. Players count them from 1.0 to 5.0. Both are
              shown here.
            </p>
          </div>
        </header>

        <ol className={styles.list}>
          {PHASES.map((phase, index) => (
            <PhaseBlock key={phase.n} phase={phase} index={index} />
          ))}
        </ol>
      </div>
    </section>
  );
}
