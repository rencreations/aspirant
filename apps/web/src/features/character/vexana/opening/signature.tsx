import { useId, type RefCallback } from "react";

import styles from "./opening.module.css";
import { SIGNATURE, SIGNATURE_BOX } from "./signature-paths";

interface Props {
  /** Ref callback for stroke `i` (from `useSignature`). */
  setStroke?: (i: number) => RefCallback<SVGPathElement>;
  /** Show it written, without the animation. */
  done?: boolean;
}

/** サナ as a signature. Strokes start blank (the stylesheet) and are written by `useSignature`. */
export function SignatureSvg({ setStroke, done = false }: Props) {
  const id = useId();
  return (
    <svg
      className={styles.sign}
      viewBox={`0 0 ${SIGNATURE_BOX.w} ${SIGNATURE_BOX.h}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={SIGNATURE_BOX.w}
          y2="0"
        >
          <stop offset="0" stopColor="#b89cff" />
          <stop offset="0.5" stopColor="#ff6ac8" />
          <stop offset="1" stopColor="#e040a0" />
        </linearGradient>
      </defs>
      <g
        transform="translate(36 0) skewX(-9)"
        fill="none"
        stroke={`url(#${id})`}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SIGNATURE.map((s, i) => (
          <path
            key={i}
            ref={setStroke?.(i)}
            d={s.d}
            pathLength={1}
            strokeWidth={s.width}
            className={styles.stroke}
            data-done={done}
          />
        ))}
      </g>
    </svg>
  );
}
