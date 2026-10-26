"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { filmArrive } from "./arrive";
import { toneHint } from "./gates";
import { useHold, useHoldProgress } from "./hold";
import { easeInOut, put, seg } from "./scroll-kit";
import { useScrollSnap } from "./snap";
import styles from "./liquid.module.css";

/**
 * A closed, smooth, slightly irregular outline around the middle of a 100 by 100 box, as a cubic
 * path (a Catmull-Rom curve through eight points whose radius varies). `seed` changes the shape.
 */
function blobPath(seed: number): string {
  const n = 8;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed * 0.7;
    const r = 36 + 5 * Math.sin(i * 2.3 + seed * 1.9) + 3 * Math.cos(i * 3.7 + seed);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const at = (i: number) => pts[((i % n) + n) % n]!;
  let d = `M${at(0)[0].toFixed(2)} ${at(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0]?.toFixed(2)} ${c1[1]?.toFixed(2)} ${c2[0]?.toFixed(2)} ${c2[1]?.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

interface Blob {
  tone: "glow" | "rim" | "paper";
  /** Where its middle sits, off the middle of the screen, in vw and vh. */
  x: number;
  y: number;
  /** The share of the hold where it starts growing and where it is full size. */
  a: number;
  b: number;
  /** How much it grows (3.3 or more covers the corners of the screen). */
  k: number;
  rot: number;
  extra: boolean;
  d: string;
}

const BLOBS: readonly Blob[] = [
  { tone: "glow", x: 0, y: 0, a: 0.07, b: 0.8, k: 3.95, rot: 20, extra: true, d: blobPath(1) },
  { tone: "rim", x: 0, y: 0, a: 0.09, b: 0.77, k: 3.75, rot: -30, extra: false, d: blobPath(2) },
  { tone: "paper", x: 0, y: 0, a: 0.11, b: 0.74, k: 3.45, rot: 40, extra: false, d: blobPath(3) },
  { tone: "paper", x: -7, y: 5, a: 0.16, b: 0.7, k: 3.3, rot: -55, extra: true, d: blobPath(4) },
  { tone: "paper", x: 7, y: -6, a: 0.2, b: 0.71, k: 3.3, rot: 70, extra: true, d: blobPath(5) },
  { tone: "paper", x: 0, y: -9, a: 0.14, b: 0.69, k: 3.2, rot: -20, extra: true, d: blobPath(6) },
];

/** The share of the hold at which the liquid has covered the whole screen. Past it, time takes over. */
const DONE = 0.8;
/** Seconds the liquid takes to drain away and show the film once it has covered the screen. */
const DRAIN = 1.25;

/**
 * The registry to the film. The last screen of the registry (the dark voices) is held with nothing
 * white on it. Then a liquid rises from the middle, in the colour of the film section. The rise
 * follows the scroll, and it can never be left half way: stop for a moment and it either goes on by
 * itself (from half on) or sinks back (before half), see `useScrollSnap`. The film waits under
 * the held screen, already in place (see `Under` in vexana-page.tsx), so when the liquid has
 * covered the screen the registry is hidden and the liquid drains away by TIME, showing the film,
 * which fades in at the same moment. Nothing is left to scroll through to see it.
 */
export function Liquid() {
  const { range, hideContent } = useHold();
  const wash = useRef<HTMLDivElement>(null);
  const blobs = useRef<Array<HTMLDivElement | null>>([]);
  const state = useRef({ p: 0, drain: 0, done: false, tween: null as gsap.core.Tween | null });

  const draw = () => {
    const { p, drain } = state.current;
    const grow = 1 - drain;
    BLOBS.forEach((b, i) => {
      const el = blobs.current[i];
      const e = easeInOut(seg(p, b.a, b.b));
      const scale = (0.03 + b.k * e) * grow;
      put(el, "visibility", e > 0.001 && scale > 0.02 ? "visible" : "hidden");
      put(
        el,
        "transform",
        `translate3d(${String(b.x)}vw,${String(b.y)}vh,0) rotate(${(b.rot * e).toFixed(2)}deg) scale(${scale.toFixed(4)})`,
      );
    });
    const w = seg(p, 0.66, DONE) * grow;
    put(wash.current, "opacity", w.toFixed(3));
    put(wash.current, "visibility", w > 0.001 ? "visible" : "hidden");
    // The pale liquid reaches the top corner (where the nav text is) when the edge of its rim blob,
    // which is the biggest of the pale ones, is as far from the middle as the corner is.
    const rim = BLOBS[1];
    let reached = false;
    if (rim) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = 0.62 * Math.max(vw, vh);
      const radius = 0.38 * size * (0.03 + rim.k * easeInOut(seg(p, rim.a, rim.b))) * 0.92;
      reached = radius >= Math.hypot(vw / 2 - 130, vh / 2 - 40);
    }
    toneHint.set(reached && grow > 0.55 ? "light" : null);
  };

  // From the moment the screen is covered the film is shown by time: the liquid drains and the
  // film fades in. Taken back (scrolling up past the cover) it is as it was.
  useHoldProgress((p) => {
    const s = state.current;
    s.p = p;
    const covered = p >= DONE - 0.0005;
    if (covered && !s.done) {
      s.done = true;
      hideContent(true);
      filmArrive.set(true);
      s.tween?.kill();
      s.tween = gsap.to(s, {
        drain: 1,
        duration: DRAIN,
        ease: "power2.inOut",
        onUpdate: draw,
      });
    } else if (!covered && s.done) {
      s.done = false;
      s.tween?.kill();
      s.tween = null;
      s.drain = 0;
      hideContent(false);
      filmArrive.set(false);
    }
    if (!s.done) draw();
  });

  // Never left half way: the stretch the liquid rises over is snapped (a half goes on).
  useScrollSnap("liquid", () => {
    const r = range();
    return r ? { start: r.start, end: r.start + DONE * (r.end - r.start) } : null;
  });

  useEffect(() => {
    const s = state.current;
    return () => {
      s.tween?.kill();
      filmArrive.set(false);
      toneHint.set(null);
    };
  }, []);

  return (
    <div className={styles.liquid} aria-hidden="true">
      <div ref={wash} className={styles.wash} />
      {BLOBS.map((b, i) => (
        <div
          key={i}
          ref={(el) => {
            blobs.current[i] = el;
          }}
          className={styles.blob}
          data-tone={b.tone}
          data-extra={b.extra}
        >
          <svg className={styles.shape} viewBox="-50 -50 100 100" focusable="false">
            <path d={b.d} />
          </svg>
        </div>
      ))}
    </div>
  );
}
