"use client";

import { useCallback, useMemo, useRef } from "react";

import { strokeTimes } from "../../vexana/opening/opening-math";
import type { SignatureKind } from "./signature";
import { samplePath } from "../../vexana/opening/signature-outline";
import { SIGNATURE, SPARKS } from "./signature-paths";

/** How long the strokes take to write, in seconds. */
const TOTAL_S = 3.6;
const EASE = "cubic-bezier(0.45, 0.05, 0.35, 1)";

/**
 * Where the pen tip is along each stroke, as animation keyframes. The tip and the stroke share one
 * timing (duration, delay and easing), so the keyframes are simply the points of the centre line
 * at equal steps: the tip is always at the end of the ink.
 */
const TIP_FRAMES: Keyframe[][] = SIGNATURE.map((s) => {
  const pts = samplePath(s.d, 40);
  return pts.map((p, i) => {
    const offset = i / (pts.length - 1);
    return {
      offset,
      transform: `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`,
      opacity: offset < 0.03 || offset > 0.97 ? 0 : 1,
    };
  });
});

/** A sparkle's transform at size `n` (0 to 1), turning as it grows. */
const sparkAt = (x: number, y: number, size: number, n: number) =>
  `translate(${x}px, ${y}px) scale(${(size * n).toFixed(1)}) rotate(${n * 90}deg)`;

/**
 * Writes the signature stroke by stroke. Every part is one Web Animation (no frame loop): the dash
 * of each stroke's mask, the glowing tip that rides ahead of it, the sparkles at the end and the
 * band of light that passes over the finished ink. `play` starts it, `reset` takes it back to
 * blank, `setVisible` rests the shimmer while the signature is off screen.
 */
export function useSignature() {
  const els = useRef<Record<SignatureKind, Array<SVGElement | null>>>({
    mask: [],
    tip: [],
    spark: [],
    shine: [],
  });
  const running = useRef<Animation[]>([]);
  const shimmer = useRef<Animation | null>(null);

  const reg = useCallback(
    (kind: SignatureKind, i: number) => (el: SVGElement | null) => {
      els.current[kind][i] = el;
    },
    [],
  );

  const reset = useCallback(() => {
    for (const a of running.current) a.cancel();
    running.current = [];
    shimmer.current = null;
  }, []);

  const play = useCallback(() => {
    reset();
    const times = strokeTimes(
      SIGNATURE.map((s) => s.length / (s.speed ?? 1)),
      TOTAL_S,
      0.09,
    );
    const anims: Animation[] = [];
    let end = 0;
    SIGNATURE.forEach((_, i) => {
      const t = times[i];
      if (!t) return;
      const mask = els.current.mask[i];
      const tip = els.current.tip[i];
      end = Math.max(end, t.delay + t.duration);
      const timing: KeyframeAnimationOptions = {
        duration: t.duration * 1000,
        delay: t.delay * 1000,
        easing: EASE,
        fill: "both",
      };
      if (mask && typeof mask.animate === "function") {
        anims.push(mask.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], timing));
      }
      if (tip && typeof tip.animate === "function") {
        anims.push(tip.animate(TIP_FRAMES[i] ?? [], timing));
      }
    });
    SPARKS.forEach((sp, i) => {
      const el = els.current.spark[i];
      if (!el || typeof el.animate !== "function") return;
      anims.push(
        el.animate(
          [
            { transform: sparkAt(sp.x, sp.y, sp.size, 0), opacity: 0 },
            { transform: sparkAt(sp.x, sp.y, sp.size, 1), opacity: 1, offset: 0.35 },
            { transform: sparkAt(sp.x, sp.y, sp.size, 0.55), opacity: 0.9, offset: 0.7 },
            { transform: sparkAt(sp.x, sp.y, sp.size, 0), opacity: 0 },
          ],
          { duration: 900, delay: (end + sp.delay) * 1000, easing: "ease-out", fill: "both" },
        ),
      );
    });
    const shine = els.current.shine[0];
    if (shine && typeof shine.animate === "function") {
      const sweep = shine.animate(
        [{ transform: "translateX(0px)" }, { transform: "translateX(1100px)" }],
        {
          duration: 3400,
          delay: (end + 0.9) * 1000,
          easing: "cubic-bezier(0.4, 0, 0.3, 1)",
          iterations: Infinity,
          fill: "backwards",
        },
      );
      shimmer.current = sweep;
      anims.push(sweep);
    }
    running.current = anims;
  }, [reset]);

  const setVisible = useCallback((on: boolean) => {
    const s = shimmer.current;
    if (!s) return;
    if (on) s.play();
    else s.pause();
  }, []);

  return useMemo(() => ({ reg, play, reset, setVisible }), [reg, play, reset, setVisible]);
}
