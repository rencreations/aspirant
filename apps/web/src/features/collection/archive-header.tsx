"use client";

import { useEffect, useRef } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { Typewriter } from "@/components/text/typewriter";
import { ThemeZone } from "@/components/theme-zone";
import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";

import styles from "./archive-header.module.css";
import { formatRuntime } from "./format";
import { SECTIONS, SECTION_IDS, type CatalogStats, type SectionId } from "./types";

interface ArchiveHeaderProps {
  stats: CatalogStats;
  /** Open a section from its count tile. */
  onJump: (section: SectionId) => void;
}

/** A number that counts up once when it scrolls into view. The final value is the markup. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        // The last entry is how it is now (several queue up when the page is busy).
        const entry = entries[entries.length - 1];
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const run = (now: number) => {
          const k = Math.min(1, (now - start) / 900);
          const eased = 1 - (1 - k) ** 3;
          el.textContent = String(Math.round(value * eased));
          if (k < 1) raf = requestAnimationFrame(run);
        };
        el.textContent = "0";
        raf = requestAnimationFrame(run);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = String(value);
    };
  }, [value]);

  return <span ref={ref}>{value}</span>;
}

/**
 * The top of the page: a terminal readout ("ARCHIVE / COLLECTION"), the page's only h1, a short
 * introduction, the total runtime and one count tile per section. The counts are computed from
 * the catalog, and each tile opens its section.
 */
export function ArchiveHeader({ stats, onJump }: ArchiveHeaderProps) {
  const items = SECTION_IDS.reduce((sum, id) => sum + stats.counts[id], 0);

  return (
    <ThemeZone theme="daybreak" surface={false} className={`${styles.header} below-nav`}>
      <div className={`${styles.grid} grid-hex fade-edges`} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <p className={styles.ghost} aria-hidden="true">
        Archive
      </p>

      <div className="relative shell">
        <p className={`${styles.code} hud-label`}>
          <StarGlyph className="size-3 text-accent" />
          <span>Archive / Collection</span>
          <span className={styles.live} aria-hidden="true" />
        </p>

        <div className={styles.layout}>
          <div className={styles.main}>
            <h1 className={`${styles.title} display`}>Collection</h1>
            <div className={styles.terminal} aria-label="Archive status">
              <p>
                <span className={styles.prompt}>&gt;</span>{" "}
                <Typewriter
                  text="open archive/collection ... ready"
                  trigger="inview"
                  caret={false}
                />
              </p>
              <p>
                <span className={styles.prompt}>&gt;</span> indexed {items} items in{" "}
                {SECTION_IDS.length} sections
              </p>
              <p>
                <span className={styles.prompt}>&gt;</span> total runtime{" "}
                <span className={styles.value}>{formatRuntime(stats.totalSeconds)}</span>
                <span className={styles.caret} aria-hidden="true" />
              </p>
            </div>
          </div>

          <div className={styles.side}>
            <p className={styles.intro}>
              Everything made for Aspirant is kept here. Watch the films, play the songs, read the
              two comics, study the art and hear every voice line.
            </p>
            <p className={styles.lead}>Take your time.</p>
            <dl className={styles.runtime}>
              <dt className="hud-label">Total runtime</dt>
              <dd>
                <span className="display text-step-5">{formatRuntime(stats.totalSeconds)}</span>
                <span className={styles.runtimeNote}>of film, music and voice</span>
              </dd>
            </dl>
          </div>
        </div>

        <ul className={styles.counts}>
          {SECTION_IDS.map((id) => {
            const meta = SECTIONS.find((s) => s.id === id);
            if (!meta) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  className={styles.tile}
                  aria-label={`${meta.label}, ${stats.counts[id]}. Show ${meta.label.toLowerCase()}`}
                  onClick={() => {
                    audio.blip("click");
                    onJump(id);
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") audio.blip("hover");
                  }}
                >
                  <span className={`${styles.count} display`} aria-hidden="true">
                    <CountUp value={stats.counts[id]} />
                  </span>
                  <span className={`${styles.tileLabel} hud-label`} aria-hidden="true">
                    {meta.filterLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ThemeZone>
  );
}
