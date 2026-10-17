"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState, type KeyboardEvent } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { ThemeZone } from "@/components/theme-zone";
import { places } from "@/content/world";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { ChapterLinks } from "../chapter-link";
import { SectionHead } from "../section-head";
import { PlaceGlyph } from "./place-glyphs";
import styles from "./places.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const COLUMNS = 3;

/**
 * The places index: nine hex cards in a honeycomb. Hover, focus or tap a card and it flips to
 * show its chapters while the inspector beside it shows the one line and the chapter links.
 * Arrow keys move between cards. It is an index, not a map: the story gives no geography.
 */
export function PlacesIndex() {
  const rootRef = useRef<HTMLElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const place = places[index] ?? places[0];

  useGSAP(
    () => {
      const cells = cellRefs.current.filter((c): c is HTMLButtonElement => c !== null);
      if (reduced || !cells.length) return;
      gsap.from(cells, {
        scale: 0.6,
        opacity: 0,
        rotate: -8,
        duration: 0.7,
        ease: "back.out(1.6)",
        stagger: { each: 0.06, from: "center", grid: [3, 3] },
        scrollTrigger: { trigger: rootRef.current, start: "top 70%", once: true },
      });
    },
    { scope: rootRef, dependencies: [reduced] },
  );

  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowDown"
            ? COLUMNS
            : e.key === "ArrowUp"
              ? -COLUMNS
              : 0;
    if (!delta) return;
    const next = i + delta;
    const target = cellRefs.current[next];
    if (!target) return;
    e.preventDefault();
    target.focus();
  };

  if (!place) return null;
  const rows = Array.from({ length: Math.ceil(places.length / COLUMNS) }, (_, r) =>
    places.slice(r * COLUMNS, r * COLUMNS + COLUMNS),
  );

  return (
    <ThemeZone theme="daybreak" aria-labelledby="places-title" className={styles.section}>
      <section ref={rootRef} className="shell">
        <SectionHead
          id="places-title"
          code="01 / Places"
          title="Where it happens"
          lead="Nine places the story keeps returning to. This is an index, not a map."
        />
        <div className={styles.layout}>
          <div className={styles.comb} role="group" aria-label="Places in the story">
            {rows.map((row, r) => (
              <div key={r} className={styles.row}>
                {row.map((p, c) => {
                  const i = r * COLUMNS + c;
                  const on = i === index;
                  return (
                    <button
                      key={p.entityId}
                      ref={(el) => {
                        cellRefs.current[i] = el;
                      }}
                      type="button"
                      className={styles.cell}
                      aria-pressed={on}
                      data-cursor="OPEN"
                      onClick={() => {
                        setIndex(i);
                        audio.blip("click");
                      }}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== "mouse" || on) return;
                        setIndex(i);
                        audio.blip("hover");
                      }}
                      onFocus={() => setIndex(i)}
                      onKeyDown={(e) => move(e, i)}
                    >
                      <span className={styles.inner} data-on={on}>
                        <span className={`${styles.face} ${styles.front}`}>
                          <PlaceGlyph id={p.entityId} className={styles.glyph} />
                          <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                          <span className={styles.name}>{p.name}</span>
                        </span>
                        <span className={`${styles.face} ${styles.back}`} aria-hidden="true">
                          <StarGlyph className={styles.backStar} />
                          <span className={styles.backLabel}>Chapters</span>
                          <span className={styles.backNums}>
                            {p.chapterIds.map((id) => id.replace(/^c0?/, "")).join(" / ")}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className={styles.inspector} aria-live="polite">
            <p className={`${styles.count} hud-label`}>
              Place {String(index + 1).padStart(2, "0")} of {String(places.length).padStart(2, "0")}
            </p>
            <div key={place.entityId} className={styles.detail}>
              <PlaceGlyph id={place.entityId} className={styles.bigGlyph} />
              <h3 className={`${styles.placeName} display`}>{place.name}</h3>
              <p className={styles.line}>{place.line}</p>
              <ChapterLinks ids={place.chapterIds} />
            </div>
          </div>
        </div>
      </section>
    </ThemeZone>
  );
}
