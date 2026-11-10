"use client";

import { memo, useEffect, useMemo, useRef } from "react";

import styles from "./shell.module.css";
import { contourPaths } from "./contours";
import type { RingGeometry } from "./ring";

interface Props {
  /** The colour field of each character, in the order of the ring. */
  fields: ReadonlyArray<{ slug: string; main: string; deep: string }>;
  /** The character whose field shows. */
  active: number;
  geometry: RingGeometry | null;
}

/**
 * The colour field and its contour lines. Each character has its own field, and the change from
 * one to the next is a fade of opacity (never a change of colour). The lines are drawn once per
 * screen size and breathe out once when a new character comes to the front.
 */
export const Background = memo(function Background({ fields, active, geometry }: Props) {
  const lines = useRef<SVGSVGElement>(null);

  const paths = useMemo(() => {
    if (!geometry) return [];
    const { view, win } = geometry;
    const cy = geometry.narrow ? 0.36 * view.h : 0.47 * view.h;
    const gap = Math.max(26, Math.min(view.w, view.h) * 0.055);
    return contourPaths({ cx: view.w / 2, cy, hw: win.w / 2, hh: win.h / 2 }, view, gap);
  }, [geometry]);

  useEffect(() => {
    lines.current?.animate(
      [
        { transform: "scale(0.965)", opacity: 0.35 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 1600, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [active]);

  return (
    <div className={styles.field} aria-hidden="true">
      {fields.map((f, i) => (
        <i
          key={f.slug}
          className={styles.fieldLayer}
          data-on={i === active}
          style={{ background: `linear-gradient(160deg, ${f.main} 18%, ${f.deep} 100%)` }}
        />
      ))}
      {geometry ? (
        <svg
          ref={lines}
          className={styles.lines}
          viewBox={`0 0 ${geometry.view.w} ${geometry.view.h}`}
          preserveAspectRatio="none"
        >
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      ) : null}
    </div>
  );
});
