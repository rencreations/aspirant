"use client";

import { useCallback, useMemo, useRef } from "react";

import { strokeTimes } from "./opening-math";
import { SIGNATURE } from "./signature-paths";

/** How long the whole signature takes to write, in seconds. */
const TOTAL_S = 3.4;

/**
 * Writes the signature stroke by stroke. Every stroke is one Web Animation of its dash offset
 * (no frame loop). `play` starts it, `reset` takes it back to blank. Strokes are `path`
 * elements with `pathLength="1"`, blank by default in the stylesheet.
 */
export function useSignature() {
  const paths = useRef<Array<SVGPathElement | null>>([]);
  const running = useRef<Animation[]>([]);

  const set = useCallback(
    (i: number) => (el: SVGPathElement | null) => {
      paths.current[i] = el;
    },
    [],
  );

  const reset = useCallback(() => {
    for (const a of running.current) a.cancel();
    running.current = [];
  }, []);

  const play = useCallback(() => {
    reset();
    const times = strokeTimes(
      SIGNATURE.map((s) => s.length),
      TOTAL_S,
      0.1,
    );
    running.current = paths.current.flatMap((el, i) => {
      const t = times[i];
      if (!el || !t || typeof el.animate !== "function") return [];
      return [
        el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: t.duration * 1000,
          delay: t.delay * 1000,
          easing: "cubic-bezier(0.45, 0.05, 0.35, 1)",
          fill: "both",
        }),
      ];
    });
  }, [reset]);

  return useMemo(() => ({ set, play, reset }), [set, play, reset]);
}
