import type { Slug } from "@/content/types";

import type { RosterPair } from "./entries";
import { frameOf, pointsOf, trimOf } from "./frame";
import { BOARD_W, SEAMS, SLOTS } from "./layout";
import styles from "./roster.module.css";
import { SLASH_ART, SLASH_FROM, SLASH_TO } from "./slash";

/** The frame of every panel, worked out once. */
const FRAMES = new Map(
  SLOTS.map((s) => {
    const frame = frameOf(s);
    return [s.slug, { frame, trim: trimOf(frame) }] as const;
  }),
);

/** Paints the frames share. The shapes refer to them by id. */
export function FrameDefs() {
  return (
    <svg className={styles.defs} width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rosterSilver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f8fd" />
          <stop offset="0.34" stopColor="#b3bfd6" />
          <stop offset="0.6" stopColor="#e7ecf7" />
          <stop offset="1" stopColor="#8795b6" />
        </linearGradient>
        <pattern
          id="rosterHatch"
          width="3.2"
          height="3.2"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(57)"
        >
          <rect width="0.9" height="3.2" fill="#fff" />
        </pattern>
        <pattern id="rosterTicks" width="2.4" height="1.5" patternUnits="userSpaceOnUse">
          <rect width="0.55" height="1.5" fill="#46517a" />
        </pattern>
      </defs>
    </svg>
  );
}

/** The silver bevel of a panel, its dark line and the small marks in the bevel. Under the picture. */
export function PanelFrame({ slug }: { slug: Slug }) {
  const art = FRAMES.get(slug);
  if (!art) return null;
  const { frame: f, trim: t } = art;
  const top = [f.outer[5], f.outer[0], f.outer[1]].filter((p) => p !== undefined);
  const bottom = [f.outer[2], f.outer[3], f.outer[4]].filter((p) => p !== undefined);
  return (
    <svg
      className={styles.frame}
      viewBox={`0 0 ${f.w} ${f.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points={pointsOf(f.outer)} fill="url(#rosterSilver)" />
      <polygon points={pointsOf(f.outer)} fill="url(#rosterHatch)" opacity="0.5" />
      <polygon className={styles.rimTint} points={pointsOf(f.outer)} />
      <polyline
        className={styles.bevelLight}
        points={pointsOf(top)}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        className={styles.bevelDark}
        points={pointsOf(bottom)}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
      {t.ticks.map((r) => (
        <rect key={`${r.x}-${r.y}`} {...r} fill="url(#rosterTicks)" opacity="0.8" />
      ))}
      {t.notches.map((r) => (
        <rect key={`${r.x}-${r.y}`} {...r} className={styles.notch} />
      ))}
      <polygon className={styles.line} points={pointsOf(f.line)} />
      <polygon className={styles.lineTint} points={pointsOf(f.line)} />
      {t.screws.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="1" className={styles.screw} />
          <path
            d={`M${(x - 0.55).toFixed(2)} ${(y + 0.45).toFixed(2)}L${(x + 0.55).toFixed(2)} ${(y - 0.45).toFixed(2)}`}
            className={styles.screwSlot}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}

/** The bright bar and the brackets on the edge of the picture. Over the picture. */
export function PanelTrim({ slug }: { slug: Slug }) {
  const art = FRAMES.get(slug);
  if (!art) return null;
  const { frame: f, trim: t } = art;
  const id = `rosterBar-${slug}`;
  return (
    <svg
      className={styles.trim}
      viewBox={`0 0 ${f.w} ${f.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect {...t.bar} fill={`url(#${id})`} className={styles.bar} />
      <path className={styles.bracket} d={t.tl} fill="none" vectorEffect="non-scaling-stroke" />
      <path className={styles.bracket} d={t.br} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Everything drawn between the panels, on one layer in board units: the red slash between
 * Obsidia and Selena, and the thin lines in the colours of the other pairs along the gaps between
 * their panels. It never takes the pointer.
 */
export function Seams({ pairs }: { pairs: readonly RosterPair[] }) {
  const colours = new Map(pairs.map((p) => [p.id, p.colours]));
  const h = SLASH_TO - SLASH_FROM;
  return (
    <svg
      className={styles.seams}
      viewBox={`0 ${SLASH_FROM} ${BOARD_W} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {SEAMS.map((s) => {
          const c = colours.get(s.pair) ?? ["#fff", "#fff"];
          return (
            <linearGradient
              key={s.pair}
              id={`rosterSeam-${s.pair}`}
              gradientUnits="userSpaceOnUse"
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
            >
              <stop offset="0" stopColor={c[0]} />
              <stop offset="1" stopColor={c[1]} />
            </linearGradient>
          );
        })}
      </defs>

      {SEAMS.map((s) => {
        const diagonal = s.y1 !== s.y2;
        const gradient = `url(#rosterSeam-${s.pair})`;
        return (
          <g key={s.pair} className={styles.seam}>
            <line
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={gradient}
              strokeWidth="3.4"
              className={styles.seamWide}
            />
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={gradient} strokeWidth="1.1" />
            <line
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              className={styles.seamCore}
              strokeWidth="0.36"
            />
            {/* A strip of ticks beside the line, and a diamond on each end. */}
            <line
              x1={s.x1 + (diagonal ? 2.7 : 0)}
              y1={s.y1 + (diagonal ? 0 : 2.3)}
              x2={s.x2 + (diagonal ? 2.7 : 0)}
              y2={s.y2 + (diagonal ? 0 : 2.3)}
              className={styles.seamTicks}
              strokeWidth="1"
              strokeDasharray="0.5 2"
            />
            {[
              [s.x1, s.y1],
              [s.x2, s.y2],
            ].map(([x = 0, y = 0]) => (
              <path
                key={`${x}-${y}`}
                d={`M${(x - 2.2).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y - 2.2).toFixed(1)}L${(x + 2.2).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + 2.2).toFixed(1)}Z`}
                fill={gradient}
                className={styles.seamEnd}
              />
            ))}
          </g>
        );
      })}

      {/* The slash. The dark body and its cracks stay still; the bright parts pulse. */}
      <g className={styles.slash}>
        <path d={SLASH_ART.halo} className={styles.slashHalo} />
        <path d={SLASH_ART.body} className={styles.slashBody} />
        <path d={SLASH_ART.mid} className={styles.slashMid} />
        <path d={SLASH_ART.cracks} className={styles.slashCracks} />
        <path d={SLASH_ART.shards} className={styles.slashShards} />
        <path d={SLASH_ART.edge} className={styles.slashEdge} />
        <g className={styles.idle}>
          <g className={styles.slashHot}>
            <path d={SLASH_ART.halo} className={styles.slashGlow} />
            <path d={SLASH_ART.mid} className={styles.slashHotMid} />
            <path d={SLASH_ART.sparks} className={styles.slashSparks} />
          </g>
        </g>
        <path d={SLASH_ART.core} className={styles.slashCore} />
        <path d={SLASH_ART.zigzag} className={styles.slashZig} />
      </g>
    </svg>
  );
}
