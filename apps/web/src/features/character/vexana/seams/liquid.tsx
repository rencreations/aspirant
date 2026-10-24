"use client";

import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";

import { toneHint } from "./gates";
import { useHold, useHoldProgress } from "./hold";
import { easeInOut, put, seg } from "./scroll-kit";
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

/** Past this share of the hold the page goes on by itself to the next section. */
const SNAP_AT = 0.64;

/**
 * The registry to the film. The last screen of the registry (the dark voices) is held with nothing
 * white on it. Then a liquid rises from the middle, in the colour of the film section, and past
 * about two thirds of the way the page carries on by itself to the film (the same colour, so
 * there is no seam). Scrolling back before that plays it backwards. The scroll is taken over
 * only once, and a wheel turned the other way gives it back.
 */
export function Liquid() {
  const { root } = useHold();
  const lenis = useLenis();
  const wash = useRef<HTMLDivElement>(null);
  const blobs = useRef<Array<HTMLDivElement | null>>([]);
  const state = useRef({ last: 0, busy: false, timer: 0 });
  const lenisRef = useRef(lenis);

  useEffect(() => {
    lenisRef.current = lenis;
  });

  // A wheel turned back while the page is carrying on by itself gives the scroll back.
  useEffect(() => {
    const s = state.current;
    const onWheel = (e: WheelEvent) => {
      if (!s.busy || e.deltaY >= 0) return;
      s.busy = false;
      window.clearTimeout(s.timer);
      lenisRef.current.scrollTo(window.scrollY, { immediate: true });
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.clearTimeout(s.timer);
      toneHint.set(null);
    };
  }, []);

  useHoldProgress((p) => {
    BLOBS.forEach((b, i) => {
      const el = blobs.current[i];
      const e = easeInOut(seg(p, b.a, b.b));
      put(el, "visibility", e > 0.001 ? "visible" : "hidden");
      put(
        el,
        "transform",
        `translate3d(${String(b.x)}vw,${String(b.y)}vh,0) rotate(${(b.rot * e).toFixed(2)}deg) scale(${(0.03 + b.k * e).toFixed(4)})`,
      );
    });
    put(wash.current, "opacity", seg(p, 0.66, 0.8).toFixed(3));
    put(wash.current, "visibility", p > 0.65 ? "visible" : "hidden");
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
    toneHint.set(reached && p < 0.995 ? "light" : null);

    const s = state.current;
    if (p > SNAP_AT && p > s.last && p < 0.995 && !s.busy) {
      const el = root.current;
      if (el) {
        s.busy = true;
        lenisRef.current.scrollTo(el.getBoundingClientRect().bottom + window.scrollY, {
          duration: 1.2,
        });
        window.clearTimeout(s.timer);
        s.timer = window.setTimeout(() => {
          s.busy = false;
        }, 1500);
      }
    }
    if (p < 0.5) s.busy = false;
    s.last = p;
  });

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
