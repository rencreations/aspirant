"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { asset } from "@/lib/asset";

import kit from "../kit.module.css";

import { artLayout, artName, heroIndex } from "./art-layout";
import styles from "./art-wall.module.css";
import type { PhaseArt } from "./types";

interface ArtWallProps {
  /** 1 to 5. Each phase's wall arrives in its own way. */
  phase: number;
  arts: readonly PhaseArt[];
  /** The phase's art is on the left: the wall is composed the other way round. */
  flip: boolean;
}

/** The official art is the game's own: the credit the site gives it everywhere. */
const CREDIT = { name: "Moonton", platform: "Mobile Legends: Bang Bang" } as const;

const two = (n: number) => String(n).padStart(2, "0");

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * One picture of the wall: the whole picture in its own shape, in a window with a hairline and a
 * small index under it, the way the phase's two skins hang. The pointer draws the picture a
 * little toward itself inside the window and the line under it names it; a press opens it large.
 */
function Tile({
  art,
  index,
  total,
  hero,
  onOpen,
}: {
  art: PhaseArt;
  index: number;
  total: number;
  hero: boolean;
  onOpen: (index: number) => void;
}) {
  const drift = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  // One write a frame at most, of one transform; the stylesheet eases it.
  const onMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    const el = drift.current;
    const box = el?.parentElement?.getBoundingClientRect();
    if (!el || !box || box.width === 0) return;
    const x = Math.min(0.5, Math.max(-0.5, (event.clientX - box.left) / box.width - 0.5));
    const y = Math.min(0.5, Math.max(-0.5, (event.clientY - box.top) / box.height - 0.5));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `translate3d(${(x * 2.4).toFixed(2)}%, ${(y * 2.4).toFixed(2)}%, 0) scale(1.06)`;
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    if (drift.current) drift.current.style.transform = "";
  };

  return (
    <li className={styles.tile} data-in="false" data-in-at="18" data-hero={hero} style={i(index)}>
      <button
        type="button"
        className={styles.hit}
        aria-label={`View larger: ${art.alt}`}
        aria-haspopup="dialog"
        data-cursor="ZOOM"
        onClick={() => {
          onOpen(index);
        }}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <span className={styles.frame} style={{ aspectRatio: `${art.w} / ${art.h}` }}>
          <span className={styles.open}>
            <span className={styles.openIn}>
              <span className={styles.zoom}>
                <span ref={drift} className={styles.drift}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a file of the site, already sized */}
                  <img
                    className={styles.picture}
                    src={asset(art.src)}
                    alt=""
                    width={art.w}
                    height={art.h}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </span>
              </span>
            </span>
          </span>
          <span className={styles.cover} aria-hidden="true" />
          <span className={styles.cover} aria-hidden="true" />
        </span>
        <span className={styles.caption} aria-hidden="true">
          <span className={styles.captionRule} />
          <span className={styles.index}>
            {two(index + 1)} / {two(total)}
          </span>
          <span className={styles.nameMask}>
            <span className={styles.name}>{artName(art.alt)}</span>
          </span>
          <span className={styles.grow}>
            <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
              <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
            </svg>
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The official art of a phase, large. The wall is composed by the number of pictures: two hang as
 * a pair at two heights, four as a stepped collage, five around a large one. Every picture is
 * whole, in its own shape. Each phase's pictures arrive in their own way (dealt like cards, opened
 * from two edges, slid out of a slot, opened from a hairline, wiped on a slant), all of them
 * transforms and opacity. A press opens the picture in the site's viewer, which gives the focus
 * back to the picture when it closes.
 */
export function ArtWall({ phase, arts, flip }: ArtWallProps) {
  const [open, setOpen] = useState<number | null>(null);

  const items = useMemo<ViewerImage[]>(
    () =>
      arts.map((art) => ({
        src: art.src,
        thumb: art.thumb,
        alt: art.alt,
        width: art.w,
        height: art.h,
        title: artName(art.alt),
        set: `about-phase-${phase}`,
        setLabel: "Official art",
        credit: CREDIT,
      })),
    [arts, phase],
  );

  if (arts.length === 0) return null;

  const total = arts.length;
  const hero = heroIndex(total);

  return (
    <div
      className={styles.wall}
      data-phase-part="art"
      data-phase={phase}
      data-flip={flip}
      data-layout={artLayout(total)}
    >
      <header className={styles.head} data-in="false">
        <p className={kit.eyebrow}>
          <span className={styles.headMask}>
            <b className={styles.headWord}>Official art</b>
          </span>
          <span className={kit.eyebrowRule} aria-hidden="true" />
          <span className={styles.headMask}>
            <span className={styles.headCount}>
              {two(total)} {total === 1 ? "picture" : "pictures"}
            </span>
          </span>
        </p>
      </header>

      <ul className={styles.grid}>
        {arts.map((art, index) => (
          <Tile
            key={art.id}
            art={art}
            index={index}
            total={total}
            hero={index === hero}
            onOpen={setOpen}
          />
        ))}
      </ul>

      <p className={styles.note} data-in="false">
        <span className={kit.rule} aria-hidden="true" />
        <span className={`${styles.noteLine} ${kit.rise}`}>
          <b>Official art</b>
          {arts.map((art) => (
            <span key={art.id} className={styles.noteName}>
              {artName(art.alt)}
            </span>
          ))}
        </span>
      </p>

      <ImageViewer
        items={items}
        index={open}
        onIndexChange={setOpen}
        label={`Official art of phase ${phase}`}
      />
    </div>
  );
}
