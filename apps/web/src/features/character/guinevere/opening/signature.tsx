import { useId, type RefCallback } from "react";

import styles from "./opening.module.css";
import { GLYPH_D } from "./signature-glyph.generated";
import { SIGNATURE, SIGNATURE_BOX, SPARKS } from "./signature-paths";

/** A four-pointed star around the origin, pointing up, right, down and left. */
const STAR =
  "M0 -1 C0.09 -0.25 0.25 -0.09 1 0 C0.25 0.09 0.09 0.25 0 1 C-0.09 0.25 -0.25 0.09 -1 0 C-0.25 -0.09 -0.09 -0.25 0 -1Z";

export type SignatureKind = "mask" | "tip" | "spark" | "shine";

interface Props {
  /** Ref callback for the animated parts (from `useSignature`). */
  reg?: (kind: SignatureKind, i: number) => RefCallback<SVGElement>;
  /** Show it written, without the animation. */
  done?: boolean;
}

/**
 * The G as a signature: the owner's fancy written G as one filled shape (a soft amber glow around
 * it and a light body), uncovered by wide dashed strokes along the letter so it is written the way
 * a hand would. A glowing pen tip rides in front of the ink, sparkles pop at the end, and a band of
 * light passes over the finished letter now and then. `useSignature` plays all of it with Web
 * Animations (no frame loop). The strokes start blank (the stylesheet).
 */
export function SignatureSvg({ reg, done = false }: Props) {
  const id = useId().replace(/:/g, "");
  const w = SIGNATURE_BOX.w;
  const h = SIGNATURE_BOX.h;
  return (
    <svg
      className={styles.sign}
      viewBox={`-30 -30 ${w + 60} ${h + 60}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}c`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
          <stop offset="0" stopColor="#fff1d6" />
          <stop offset="0.55" stopColor="#ffd0a0" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={`${id}s`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}t`}>
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.25" stopColor="#ffc27a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        {SIGNATURE.map((s, i) => (
          <mask
            key={i}
            id={`${id}m${i}`}
            maskUnits="userSpaceOnUse"
            x="-40"
            y="-40"
            width={w + 80}
            height={h + 80}
          >
            <path
              ref={reg?.("mask", i)}
              d={s.d}
              pathLength={1}
              fill="none"
              stroke="#fff"
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.stroke}
              data-done={done}
            />
          </mask>
        ))}
        <mask
          id={`${id}all`}
          maskUnits="userSpaceOnUse"
          x="-40"
          y="-40"
          width={w + 80}
          height={h + 80}
        >
          <path d={GLYPH_D} fill="#fff" fillRule="evenodd" />
        </mask>
      </defs>
      <g>
        {SIGNATURE.map((_, i) => (
          <g key={i} mask={`url(#${id}m${i})`}>
            <path
              d={GLYPH_D}
              fill="none"
              stroke="#ff8a3d"
              strokeOpacity="0.28"
              strokeWidth="9"
              strokeLinejoin="round"
            />
            <path d={GLYPH_D} fill={`url(#${id}c)`} fillRule="evenodd" />
          </g>
        ))}
        <g mask={`url(#${id}all)`}>
          <rect
            ref={reg?.("shine", 0)}
            className={styles.shine}
            x="-240"
            y="-40"
            width="220"
            height={h + 80}
            fill={`url(#${id}s)`}
          />
        </g>
        {SIGNATURE.map((_, i) => (
          <g key={i} ref={reg?.("tip", i)} className={styles.tip}>
            <circle r="26" fill={`url(#${id}t)`} />
            <circle r="4.2" fill="#fff" />
          </g>
        ))}
        {SPARKS.map((_, i) => (
          <path key={i} ref={reg?.("spark", i)} className={styles.spark} d={STAR} fill="#fff" />
        ))}
      </g>
    </svg>
  );
}
