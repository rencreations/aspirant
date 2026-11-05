"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";
import { characterRoute, collectionRoute } from "@/lib/site";

import { CanonBadge } from "../shell/credit";
import { FilmCard } from "./film-card";
import { runtimeWords, totalRuntime, type RowDef } from "./film-data";
import styles from "./films.module.css";
import type { Film } from "./types";
import { useReveal } from "./use-reveal";

interface RowProps {
  row: RowDef;
  /** Position of the row on the page, shown as `01`. */
  number: number;
  films: readonly Film[];
  onOpen: (film: Film) => void;
  /** The drama and the parody add a line of their own. */
  children?: React.ReactNode;
}

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/** A row of films: a header with the count and the arrows, then cards that scroll and snap. */
export function FilmRow({ row, number, films, onOpen, children }: RowProps) {
  const [ref, seen] = useReveal<HTMLElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft < 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, films.length]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    audio.blip("click");
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const id = `row-${row.id}`;
  return (
    <section ref={ref} className={styles.row} data-in={seen} data-row={row.id} aria-labelledby={id}>
      <header className={`${styles.rowHead} shell`}>
        <span className={`${styles.rowNumber} hud-label`}>{String(number).padStart(2, "0")}</span>
        <div className={styles.rowTitleBox}>
          <h2 id={id} className={`${styles.rowTitle} display`}>
            {row.title}
          </h2>
          <p className={styles.rowNote}>{row.note}</p>
        </div>
        <p className={`${styles.rowCount} hud-label`}>
          <span>{films.length === 1 ? "1 film" : `${films.length} films`}</span>
          <span aria-hidden="true" className={styles.rowDot} />
          <span>{runtimeWords(totalRuntime(films))}</span>
        </p>
        <div className={styles.arrows}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={`${row.title}: earlier films`}
            disabled={edge.start}
            onClick={() => {
              page(-1);
            }}
          >
            <Arrow dir="prev" />
          </button>
          <button
            type="button"
            className={styles.arrow}
            aria-label={`${row.title}: later films`}
            disabled={edge.end}
            onClick={() => {
              page(1);
            }}
          >
            <Arrow dir="next" />
          </button>
        </div>
      </header>
      {children}
      <div ref={scroller} className={styles.scroller} role="list" aria-label={row.title}>
        {films.map((film, i) => (
          <div key={film.id} role="listitem" className={styles.cell}>
            <FilmCard film={film} index={i} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}

interface LinkRowProps {
  number: number;
  title: string;
  note: string;
  /** The room it leads to. */
  room: "design" | "fanart";
  action: string;
}

/** A row that holds no films of its own: it leads to the room that owns them. */
export function LinkRow({ number, title, note, room, action }: LinkRowProps) {
  const [ref, seen] = useReveal<HTMLElement>();
  const id = `row-${room}`;
  return (
    <section
      ref={ref}
      className={styles.row}
      data-in={seen}
      data-row={`link-${room}`}
      aria-labelledby={id}
    >
      <div className={`${styles.linkRow} shell`}>
        <span className={`${styles.rowNumber} hud-label`}>{String(number).padStart(2, "0")}</span>
        <div className={styles.rowTitleBox}>
          <h2 id={id} className={`${styles.rowTitle} display`}>
            {title}
          </h2>
          <p className={styles.rowNote}>{note}</p>
        </div>
        <TLink
          href={collectionRoute(room)}
          transitionLabel={room === "design" ? "Design" : "Fanart"}
          className={styles.linkAction}
        >
          <span className="hud-label">{action}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </TLink>
      </div>
    </section>
  );
}

/** The plain notice above the parody. */
export function ParodyNotice() {
  return (
    <div className={`${styles.parodyNotice} shell`} role="note">
      <CanonBadge canon="non-canon" />
      <p>
        This is a live-action parody, made outside the story. Its school, its rivals and its monster
        are not part of Aspirant, and nothing in it counts as canon.
      </p>
    </div>
  );
}

/** The line above the drama: the films are chapters of a story that the game lets you steer. */
export function DramaNote() {
  return (
    <div className={`${styles.dramaNote} shell`}>
      <p>
        The films are the chapters of a branching story. Make the choices yourself on Vexana's page.
      </p>
      <TLink href={characterRoute("vexana")} transitionLabel="Vexana" className={styles.linkAction}>
        <span className="hud-label">Play it on Vexana's page</span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </TLink>
    </div>
  );
}
