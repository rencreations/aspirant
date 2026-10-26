"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import type { FrameShape } from "@/components/frame/frame-shapes";
import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import type { LightboxItem } from "@/components/ui/lightbox";
import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";
import { routes } from "@/lib/site";

import type { FanArtView } from "../types";
import styles from "./hall.module.css";

const Lightbox = dynamic(() => import("@/components/ui/lightbox").then((m) => m.Lightbox), {
  ssr: false,
});

const WHO = { fanny: "Fanny", layla: "Layla", both: "Fanny and Layla" } as const;

const TALL: readonly FrameShape[] = ["arch", "chamfer", "ticket", "star"];
const SQUARE: readonly FrameShape[] = ["bite", "chamfer", "emblem"];
const WIDE: readonly FrameShape[] = ["parallelogram", "rift", "chamfer"];

function layout(art: FanArtView, i: number): { shape: FrameShape; kind: string } {
  const r = art.height / art.width;
  if (r > 1.15) return { shape: TALL[i % TALL.length] ?? "arch", kind: "tall" };
  if (r < 0.85) return { shape: WIDE[i % WIDE.length] ?? "chamfer", kind: "wide" };
  return { shape: SQUARE[i % SQUARE.length] ?? "chamfer", kind: "square" };
}

/**
 * Hall of fame: fan art in varied frames that float at different depths as you scroll. Each
 * piece shows its credit (and a link to the original when we know it); clicking opens the
 * Lightbox, loaded on first use.
 */
export function HallOfFame({ art, total }: { art: readonly FanArtView[]; total: number }) {
  const gridRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  const change = (next: number | null) => {
    setIndex(next);
    // Return focus to the piece that opened the viewer.
    if (next === null) requestAnimationFrame(() => opener.current?.focus());
  };

  const items = useMemo<LightboxItem[]>(
    () =>
      art.map((a) => ({
        type: "image",
        src: a.src,
        alt: `${a.title ?? "Fan art"}, ${WHO[a.character]}`,
        width: a.width,
        height: a.height,
        caption: `${a.title ?? "Untitled"} / ${WHO[a.character]}`,
        credit: { name: a.credit, ...(a.href ? { href: a.href } : {}) },
      })),
    [art],
  );

  // Float: each tile drifts at its own depth while the hall is on screen.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || prefersReducedMotion()) return;
    const tiles = Array.from(grid.querySelectorAll<HTMLElement>("[data-depth]"));
    let raf = 0;
    let on = false;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const tile of tiles) {
        const r = tile.getBoundingClientRect();
        const offset = (r.top + r.height / 2 - vh / 2) / vh;
        const depth = Number(tile.dataset.depth);
        tile.style.setProperty("--float", `${(-offset * depth * 70).toFixed(1)}px`);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver((entries) => {
      // The last entry is how it is now (several queue up when the page is busy).
      const entry = entries[entries.length - 1];
      const next = entry?.isIntersecting ?? false;
      if (next === on) return;
      on = next;
      if (on) {
        window.addEventListener("scroll", schedule, { passive: true });
        schedule();
      } else window.removeEventListener("scroll", schedule);
    });
    io.observe(grid);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <ThemeZone theme="daybreak" aria-labelledby="hall-title" className={styles.section}>
      <div className={`${styles.head} shell`}>
        <div>
          <p className="hud-label">06 / Hall of fame</p>
          <h2 id="hall-title" className={styles.title}>
            Hall of fame
          </h2>
        </div>
        <div className={styles.note}>
          <p>
            People drew these because the story stayed with them. This is fan work, shown with the
            artist&rsquo;s credit and a link to the original wherever we know it.
          </p>
          <TLink href={routes.collection} className={styles.more} transitionLabel="Collection">
            All {total} pieces in the Collection
            <span aria-hidden="true"> &rarr;</span>
          </TLink>
        </div>
      </div>

      <ul ref={gridRef} className={`${styles.grid} shell`}>
        {art.map((a, i) => {
          const { shape, kind } = layout(a, i);
          const depth = [0.4, 1.1, 0.7, 1.4, 0.55, 1][i % 6] ?? 1;
          return (
            <li
              key={a.id}
              className={styles.tile}
              data-kind={kind}
              data-depth={depth}
              style={
                { "--tile-glow": a.color, "--ratio": `${a.width} / ${a.height}` } as CSSProperties
              }
            >
              <button
                type="button"
                className={styles.open}
                aria-haspopup="dialog"
                data-cursor="VIEW"
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") audio.blip("hover");
                }}
                onClick={(e) => {
                  audio.unlock();
                  opener.current = e.currentTarget;
                  setOpened(true);
                  setIndex(i);
                }}
              >
                <Frame
                  as="span"
                  shape={shape}
                  accent={a.color}
                  className={styles.frame}
                  maxTilt={6}
                >
                  <FrameImage
                    src={a.thumb}
                    alt={`${a.title ?? "Fan art"}, ${WHO[a.character]}`}
                    width={a.width}
                    height={a.height}
                    parallax={4}
                  />
                </Frame>
                <span className={styles.tag}>{WHO[a.character]}</span>
              </button>
              <p className={styles.credit}>
                <span>{a.credit}</span>
                {a.href && (
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.source}
                  >
                    Original
                    <span className="sr-only">: {a.title ?? "fan art"} (opens in a new tab)</span>
                  </a>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      {opened && (
        <Lightbox items={items} index={index} onIndexChange={change} label="Hall of fame" />
      )}
    </ThemeZone>
  );
}
