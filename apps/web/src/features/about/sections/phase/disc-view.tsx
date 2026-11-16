"use client";

import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { DISC, hubRings } from "@/features/library/music/disc-shape";
import { asset } from "@/lib/asset";

import { fillRing, rimWords, titleLines, titleSize } from "./disc-math";
import { useDiscMotion, useDiscRing } from "./disc-motion";
import styles from "./disc-view.module.css";
import type { PhaseTrack } from "./types";

/** The drawing of a disc is 1000 across. The proportions are the Music room's own (`DISC`). */
const C = 500;
const HOLE = C * DISC.hole;
const HUB = C * DISC.hub;
const FACE = C * DISC.faceOut;
const RINGS = hubRings();
const WORDS_AT = C * 0.915;
const WORD_SIZE = 14.6;
/** A mono capital is 0.6 of its size wide: so many fit the ring with the room's spacing of 2.6. */
const RING_ROOM = (2 * Math.PI * WORDS_AT) / (WORD_SIZE * 0.6 + 2.6);

/** A full circle of radius `r` as a path, drawn clockwise from its upper left. */
function circle(r: number): string {
  const k = r * Math.SQRT1_2;
  return `M${(C - k).toFixed(2)} ${(C - k).toFixed(2)}A${r} ${r} 0 1 1 ${(C + k).toFixed(2)} ${(C + k).toFixed(2)}A${r} ${r} 0 1 1 ${(C - k).toFixed(2)} ${(C - k).toFixed(2)}Z`;
}

/** The band between two radii. */
const band = (inner: number, outer: number) => `${circle(outer)}${circle(inner)}`;

/**
 * What is printed on a disc, over its picture: the dark foot and rim that let the type read on
 * any picture, the ring of words along the rim, the EP and the title, then the white rim and the
 * three rings of the hub. It is the face the Music room prints (`disc-art.ts`), drawn as a
 * vector, so it stays sharp at any size and nothing is drawn by a script.
 */
function DiscPrint({ track }: { track: PhaseTrack }) {
  const id = `disc-${track.id}`;
  const words = fillRing(rimWords(track), RING_ROOM);
  // The spacing that closes the ring exactly on the last letter.
  const spacing = (2 * Math.PI * WORDS_AT) / Math.max(1, words.length) - WORD_SIZE * 0.6;
  const lines = titleLines(track.title);
  const size = titleSize(lines, 568);
  const base = 800;
  const top = base - (lines.length - 1) * size;
  return (
    <svg className={styles.print} viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
      <defs>
        <path id={`${id}-ring`} d={circle(WORDS_AT)} />
        <clipPath id={`${id}-face`}>
          <path d={band(HUB, FACE)} clipRule="evenodd" />
        </clipPath>
        <linearGradient
          id={`${id}-foot`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="500"
          x2="0"
          y2="1000"
        >
          <stop offset="0" stopColor="#05070c" stopOpacity="0" />
          <stop offset="0.6" stopColor="#05070c" stopOpacity="0.3" />
          <stop offset="1" stopColor="#05070c" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" cx="500" cy="500" r={FACE}>
          <stop offset="0.8" stopColor="#05070c" stopOpacity="0" />
          <stop offset="1" stopColor="#05070c" stopOpacity="0.5" />
        </radialGradient>
        <radialGradient id={`${id}-metal`} gradientUnits="userSpaceOnUse" cx="500" cy="500" r={HUB}>
          <stop offset="0.6" stopColor="#d9dde4" />
          <stop offset="0.74" stopColor="#f4f6f8" />
          <stop offset="0.86" stopColor="#cfd4dc" />
          <stop offset="1" stopColor="#b8bec8" />
        </radialGradient>
      </defs>

      <g clipPath={`url(#${id}-face)`}>
        <rect x="0" y="500" width="1000" height="500" fill={`url(#${id}-foot)`} />
        <rect x="0" y="0" width="1000" height="1000" fill={`url(#${id}-rim)`} />
        <text className={styles.words} style={{ letterSpacing: `${spacing.toFixed(3)}px` }}>
          <textPath href={`#${id}-ring`} startOffset="0">
            {words}
          </textPath>
        </text>
        <text className={styles.kicker} x="500" y={top - size * 0.86}>
          {track.ep}
        </text>
        {lines.map((line, k) => (
          <text
            key={line}
            className={styles.title}
            x="500"
            y={top + k * size}
            style={{ fontSize: `${size}px` }}
          >
            {line}
          </text>
        ))}
      </g>

      {/* The rim: a thin white edge with a line on each side. */}
      <path className={styles.rim} d={band(FACE, C - 0.75)} fillRule="evenodd" />
      {/* The hub: clear, then metal, then frosted next to the hole. */}
      <path
        className={styles.clear}
        d={band(C * RINGS.clear[0], C * RINGS.clear[1])}
        fillRule="evenodd"
      />
      <path
        d={band(C * RINGS.metal[0], C * RINGS.metal[1])}
        fill={`url(#${id}-metal)`}
        fillRule="evenodd"
      />
      <path
        className={styles.frost}
        d={band(C * RINGS.frost[0], C * RINGS.frost[1])}
        fillRule="evenodd"
      />
      {[HOLE, C * RINGS.frost[1], C * RINGS.metal[1], HUB].map((r) => (
        <circle key={r} className={styles.seam} cx="500" cy="500" r={r} />
      ))}
    </svg>
  );
}

interface DiscViewProps {
  track: PhaseTrack;
  /** Its place among the phase's discs: two discs never lean in step. */
  slot: number;
  /** Its track is the one in the player. */
  active: boolean;
  /** Its track is sounding. */
  playing: boolean;
  /** What a press on the disc says it does. */
  label: string;
  /** The word the site's cursor shows over it. */
  cursor: string;
  onPress: () => void;
  /** Drawn over the middle of the disc and not turning with it (the play mark of the video). */
  children?: ReactNode;
}

/**
 * One disc of the music decks: the Music room's disc, facing the visitor. It is a few flat layers
 * under one perspective and no canvas: the back, a hair behind; the face, which turns (the
 * picture, the print and a real hole); the light, which does not turn; and the ring that shows
 * how far the track has played. See `disc-motion.ts` for how it moves.
 */
export function DiscView({
  track,
  slot,
  active,
  playing,
  label,
  cursor,
  onPress,
  children,
}: DiscViewProps) {
  const box = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLSpanElement>(null);
  const spin = useRef<HTMLDivElement>(null);
  const wobble = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const press = useDiscMotion({ box, tilt, sheen, spin, wobble }, playing);
  useDiscRing({ first, second, head }, active, track.duration);

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    press(e.clientX, e.clientY);
  };

  return (
    <div
      ref={box}
      className={styles.disc}
      data-active={active}
      data-playing={playing}
      style={{ "--slot": slot } as CSSProperties}
    >
      <div className={styles.scene} aria-hidden="true">
        <div className={styles.float}>
          <div ref={tilt} className={styles.tilt}>
            <div ref={wobble} className={styles.wobble}>
              <span className={styles.back} />
              <div ref={spin} className={styles.spin}>
                {/* eslint-disable-next-line @next/next/no-img-element -- the cover is a file of the collection or of the site, shown as it is */}
                <img
                  className={styles.cover}
                  src={asset(track.disc ?? track.cover.large)}
                  width={1024}
                  height={1024}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{ backgroundColor: track.cover.colour }}
                />
                <DiscPrint track={track} />
              </div>
              <span ref={sheen} className={styles.sheen} />
              <span className={styles.ring}>
                <span className={styles.ringTrack} />
                <span className={`${styles.window} ${styles.windowFirst}`}>
                  <span ref={first} className={styles.sweep}>
                    <span className={`${styles.arc} ${styles.arcLeft}`} />
                  </span>
                </span>
                <span className={`${styles.window} ${styles.windowSecond}`}>
                  <span ref={second} className={styles.sweep}>
                    <span className={`${styles.arc} ${styles.arcRight}`} />
                  </span>
                </span>
                <span ref={head} className={styles.sweep}>
                  <span className={styles.head} />
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      {children}
      <button
        type="button"
        className={styles.hit}
        aria-label={label}
        data-cursor={cursor}
        onPointerDown={onDown}
        onClick={onPress}
      />
    </div>
  );
}
