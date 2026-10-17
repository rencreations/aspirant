"use client";

import { AnimatePresence, m } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { StarButton } from "@/components/ui/star-button";
import { ThemeZone } from "@/components/theme-zone";
import type { ThemeName } from "@/lib/stores";

import styles from "./sections.module.css";
import type { SectionMeta } from "./types";

interface SectionShellProps {
  meta: SectionMeta;
  theme: ThemeName;
  /** Items that match the filters. */
  count: number;
  /** When set, a "See all" button shows this total and calls `onSeeAll`. */
  seeAllTotal?: number;
  onSeeAll?: () => void;
  children: ReactNode;
}

/** One chapter of the archive: HUD code, heading, count, one plain line and the content. */
export function SectionShell({
  meta,
  theme,
  count,
  seeAllTotal,
  onSeeAll,
  children,
}: SectionShellProps) {
  const titleId = `collection-${meta.id}-title`;
  return (
    <ThemeZone
      theme={theme}
      surface={theme !== "storm"}
      id={meta.hash}
      aria-labelledby={titleId}
      className={styles.section}
    >
      <div className="shell">
        <header className={styles.head}>
          <div>
            <p className={`${styles.code} hud-label`}>
              <StarGlyph className="size-3 text-accent" />
              {meta.code}
            </p>
            <h2 id={titleId} className={`${styles.heading} display text-step-6`}>
              {meta.label}
              <span className={`${styles.count} mono`}>{count}</span>
            </h2>
            <p className={styles.blurb}>{meta.blurb}</p>
          </div>
          {seeAllTotal !== undefined && (
            <StarButton variant="ghost" size="sm" onClick={onSeeAll}>
              See all {seeAllTotal}
            </StarButton>
          )}
        </header>
        {children}
      </div>
    </ThemeZone>
  );
}

interface CellProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A list cell that glides to its new place when the filters change. */
export function Cell({ children, className, style }: CellProps) {
  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      style={style}
    >
      {children}
    </m.li>
  );
}

/** A list whose children animate in and out. The first render is not animated. */
export function CellList({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <ul className={className} aria-label={label}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </ul>
  );
}
