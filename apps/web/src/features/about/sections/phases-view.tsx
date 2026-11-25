"use client";

import { useEffect, type CSSProperties, type ReactNode, type RefObject } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import {
  PHASES,
  TIMELINE_YEARS,
  saleMonth,
  timelineAt,
  type DroneFace,
  type Phase,
  type PhaseSkin,
} from "../content";

import { TetraStage } from "../tetra/tetra-stage";

import { useArrive } from "./arrive";
import kit from "./kit.module.css";
import { ArtWall } from "./phase/art-wall";
import { ComicFeature } from "./phase/comic-feature";
import { DramaFeature } from "./phase/drama-feature";
import { MusicDeck } from "./phase/music-deck";
import type { PhaseMedia } from "./phase/types";
import { VideoDeck } from "./phase/video-deck";
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

const EMPTY_MEDIA: PhaseMedia = { videos: [], tracks: [], arts: [] };

/**
 * The drone's friends meet it in the empty gap above these phases: Mr. Bunny above the third, the
 * four of them together above the fourth (Guinevere's two drones arrive as Mr. Bunny says goodbye),
 * and the two leave above the fifth. Each gap carries an anchor, so the meetings happen where the
 * page has room, whatever its size.
 */
const MEETS: ReadonlySet<number> = new Set([3, 4, 5]);

/**
 * Where the Obsidia doll lives in the fifth phase. The drone flies behind her skin's window (the
 * right one of the pair) and comes out with her on its head, and at the end of the phase it flies
 * behind her splash art (the left picture of the wall) and comes out without her. Each picture
 * carries an unseen box of its own size (`data-drone-hide`): the drone's engine reads it.
 */
const DOLL_HOME = { phase: 5, skin: "obsidia", art: "splash-obsidia" } as const;

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
                  style={{
                    objectPosition: `${skin.focus[0]}% ${skin.focus[1]}%`,
                    ...(skin.nudge
                      ? { "--zoom": skin.nudge[0], "--down": `${skin.nudge[1]}%` }
                      : {}),
                  }}
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

/**
 * One of the parts a phase adds under its two skins, with the drone's place for it: in the gap
 * above the part, at the side its head leaves empty. The side changes from part to part, so the
 * drone crosses the page as the visitor reads down it.
 */
function Part({
  id,
  side,
  face,
  children,
}: {
  id: string;
  side: "left" | "right";
  face: DroneFace;
  children: ReactNode;
}) {
  return (
    <div className={styles.part}>
      <div
        className={`${kit.anchor} ${styles.partAnchor}`}
        aria-hidden="true"
        data-side={side}
        data-drone-anchor={id}
        data-drone-face={face}
        data-drone-turn={side === "right" ? -20 : 20}
        data-drone-room="wide"
      />
      {children}
    </div>
  );
}

function PhaseBlock({ phase, index, media }: { phase: Phase; index: number; media: PhaseMedia }) {
  const flip = index % 2 === 1;
  const lower = LOWER[index] ?? 1;
  return (
    <li className={styles.phase} data-flip={flip} data-phase={phase.n}>
      {MEETS.has(phase.n) ? (
        <div
          className={`${kit.anchor} ${styles.meet}`}
          aria-hidden="true"
          data-drone-anchor={`meet-${phase.n}`}
          data-drone-face="happy"
          data-drone-turn={0}
          data-drone-room="wide"
        />
      ) : null}
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
            {phase.n === DOLL_HOME.phase && skin.slug === DOLL_HOME.skin ? (
              <div className={styles.hide} aria-hidden="true" data-drone-hide="pickup" />
            ) : null}
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

      <div className={styles.more} data-phase-more={phase.n}>
        <Part id={`phase-${phase.n}-videos`} side={flip ? "left" : "right"} face="scan">
          <VideoDeck phase={phase.n} videos={media.videos} flip={flip} />
        </Part>
        <Part id={`phase-${phase.n}-music`} side={flip ? "right" : "left"} face="happy">
          <MusicDeck
            phase={phase.n}
            tracks={media.tracks}
            flip={flip}
            {...(media.musicVideo ? { musicVideo: media.musicVideo } : {})}
          />
        </Part>
        {/* Tetra's corner has the drone's place inside it: the two meet there. */}
        {phase.n === 2 ? <TetraStage /> : null}
        {media.drama ? (
          <Part id={`phase-${phase.n}-drama`} side={flip ? "left" : "right"} face="alert">
            <DramaFeature drama={media.drama} />
          </Part>
        ) : null}
        {media.comic ? (
          <Part id={`phase-${phase.n}-comic`} side={flip ? "right" : "left"} face="squint">
            <ComicFeature phase={phase.n} comic={media.comic} flip={flip} />
          </Part>
        ) : null}
        <Part id={`phase-${phase.n}-arts`} side={flip ? "left" : "right"} face="normal">
          <ArtWall
            phase={phase.n}
            arts={media.arts}
            flip={flip}
            {...(phase.n === DOLL_HOME.phase ? { hide: { id: DOLL_HOME.art, role: "drop" } } : {})}
          />
        </Part>
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
export function PhasesView({ media }: { media: readonly PhaseMedia[] }) {
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
                <span className={kit.line}>Aspirant </span>
              </span>
              <span className={kit.mask}>
                <span className={kit.line} style={i(1)}>
                  Phases
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
              Officially, each release is a Phase. Each phase releases two Aspirant characters.
            </p>
          </div>
        </header>

        <ol className={styles.list}>
          {PHASES.map((phase, index) => (
            <PhaseBlock
              key={phase.n}
              phase={phase}
              index={index}
              media={media[index] ?? EMPTY_MEDIA}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
