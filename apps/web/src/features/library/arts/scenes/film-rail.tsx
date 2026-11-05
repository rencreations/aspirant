"use client";

import { useEffect, useRef } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { formatDuration } from "./logic";
import styles from "./scenes.module.css";
import type { ShownFilm } from "./types";

interface Props {
  shown: readonly ShownFilm[];
  activeId: string;
  onPick: (filmId: string) => void;
}

/**
 * The films as a rail: a poster, the title, the length and the number of stills. It sticks to the
 * side (to the top on a phone), shows the film that is on screen, and a press goes to that film.
 */
export function FilmRail({ shown, activeId, onPick }: Props) {
  const rail = useRef<HTMLElement>(null);
  const index = Math.max(
    0,
    shown.findIndex((s) => s.film.id === activeId),
  );

  // Keep the film that is on screen in view inside the rail.
  useEffect(() => {
    const el = rail.current;
    const item = el?.querySelectorAll<HTMLElement>("[data-rail-item]")[index];
    if (!el || !item) return;
    const narrow = el.scrollWidth > el.clientWidth + 2;
    if (narrow) {
      const left = item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2;
      el.scrollTo({ left, behavior: "smooth" });
    } else {
      const top = item.offsetTop - (el.clientHeight - item.offsetHeight) / 2;
      el.scrollTo({ top, behavior: "smooth" });
    }
  }, [index, shown.length]);

  return (
    <nav ref={rail} className={styles.rail} data-rail="" aria-label="Films">
      <div className={`${styles.railHead} hud-label`}>
        <span>Films</span>
        <span>{shown.length}</span>
      </div>
      <ul className={styles.railList} style={{ "--i": index } as React.CSSProperties}>
        <li className={styles.railMark} aria-hidden="true" />
        {shown.map((s, i) => {
          const poster = s.film.scenes[s.film.poster] ?? s.film.scenes[0];
          return (
            <li key={s.film.id}>
              <button
                type="button"
                className={styles.railItem}
                data-rail-item=""
                aria-current={i === index ? "true" : undefined}
                onClick={() => {
                  audio.blip("click");
                  onPick(s.film.id);
                }}
              >
                <span className={styles.poster} style={{ background: poster?.img.c }}>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={libUrl(poster.img.t)}
                      alt=""
                      width={96}
                      height={54}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </span>
                <span className={styles.railText}>
                  <span className={styles.railTitle}>{s.film.title}</span>
                  <span className={`${styles.railMeta} hud-label`}>
                    {formatDuration(s.film.duration)} / {s.scenes.length} stills
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
