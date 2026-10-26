"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { useLenis } from "@/components/smooth-scroll";

import { filmArrive } from "./arrive";
import { toneHint } from "./gates";
import { useHold, useHoldProgress } from "./hold";
import {
  DONE,
  arrivesDown,
  arrivesUp,
  blackAt,
  blackCovers,
  shapeClock,
  sideAt,
  whiteAt,
  type Side,
} from "./liquid-math";
import { easeInOut, put, seg } from "./scroll-kit";
import { useScrollLock } from "./scroll-lock";
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
  tone: "glow" | "rim" | "paper" | "inkglow" | "inkrim" | "ink";
  /** Where its middle sits, off the middle of the screen, in vw and vh. */
  x: number;
  y: number;
  /** The share of the (old) hold where it starts growing and where it is full size. */
  a: number;
  b: number;
  /** How much it grows (3.3 or more covers the corners of the screen). */
  k: number;
  rot: number;
  extra: boolean;
  d: string;
}

/** The white liquid, going down: the colour of the film section. */
const WHITE: readonly Blob[] = [
  { tone: "glow", x: 0, y: 0, a: 0.07, b: 0.8, k: 3.95, rot: 20, extra: true, d: blobPath(1) },
  { tone: "rim", x: 0, y: 0, a: 0.09, b: 0.77, k: 3.75, rot: -30, extra: false, d: blobPath(2) },
  { tone: "paper", x: 0, y: 0, a: 0.11, b: 0.74, k: 3.45, rot: 40, extra: false, d: blobPath(3) },
  { tone: "paper", x: -7, y: 5, a: 0.16, b: 0.7, k: 3.3, rot: -55, extra: true, d: blobPath(4) },
  { tone: "paper", x: 7, y: -6, a: 0.2, b: 0.71, k: 3.3, rot: 70, extra: true, d: blobPath(5) },
  { tone: "paper", x: 0, y: -9, a: 0.14, b: 0.69, k: 3.2, rot: -20, extra: true, d: blobPath(6) },
];

/**
 * The black liquid, going back: the same kind of stain from the middle, but its own shapes, turning
 * the other way and starting from other places, so it is not the white one in another colour.
 */
const INK: readonly Blob[] = [
  { tone: "inkglow", x: 0, y: 0, a: 0.06, b: 0.8, k: 3.95, rot: -25, extra: true, d: blobPath(11) },
  { tone: "inkrim", x: 0, y: 0, a: 0.08, b: 0.77, k: 3.75, rot: 35, extra: false, d: blobPath(12) },
  { tone: "ink", x: 0, y: 0, a: 0.1, b: 0.74, k: 3.45, rot: -45, extra: false, d: blobPath(13) },
  { tone: "ink", x: 8, y: -5, a: 0.15, b: 0.7, k: 3.3, rot: 60, extra: true, d: blobPath(14) },
  { tone: "ink", x: -8, y: 6, a: 0.19, b: 0.71, k: 3.3, rot: -75, extra: true, d: blobPath(15) },
  { tone: "ink", x: 0, y: 9, a: 0.13, b: 0.69, k: 3.2, rot: 25, extra: true, d: blobPath(16) },
];

/** Seconds from "the liquid has covered the page" to the first of it draining away. */
const DRAIN_DELAY = 0.03;
/** Seconds the liquid takes to drain away and show the next section once it has covered the page. */
const DRAIN = 0.5;
/** Seconds after the drain before the scroll is given back (the section's own fade-in is done by then). */
const SETTLE = 0.08;

interface LiquidState {
  /** The progress of the hold, clamped 0 to 1, and unclamped (below 1 is the film scrolling on). */
  p: number;
  pa: number;
  side: Side;
  started: boolean;
  /** An arrival is playing by itself: the scroll is locked and progress is ignored. */
  busy: boolean;
  /** How far each liquid has come (0 to 1) and how far it has drained (0 to 1, by time). */
  white: number;
  whiteDrain: number;
  black: number;
  blackDrain: number;
  tl: gsap.core.Timeline | null;
  /** Gives the scroll back. */
  unlock: (() => void) | null;
  /** The page has been taken to the other section (so a hurried finish need not do it again). */
  jumped: boolean;
}

/**
 * The join between the registry (01) and the film (02), both ways.
 *
 * Going down, the last screen of the registry (the dark voices) is held with nothing white on it.
 * A white liquid rises from the middle, following the scroll. It can never be left half way: stop
 * for a second and it goes on by itself (from half on) or sinks back (before half), see
 * `useScrollSnap`. When it has covered the page the scroll is LOCKED; the page goes to the film by
 * itself while it is covered (the film waits under it), the liquid drains away by time and the film
 * fades in at the same moment, and the scroll is given back once everything is in view, so nobody
 * scrolls past the film's heading by accident.
 *
 * Going back up, the film is held in place and a BLACK liquid rises the same way, from the middle,
 * over the scroll up. The same rules: it snaps after a second, and when it has covered the page the
 * scroll is locked, the page goes to the last screen of the registry, the black drains away and the
 * registry is there, whole. Nothing is held when the registry is arrived at, so the visitor goes on
 * up through it as usual.
 */
export function Liquid() {
  const { range, hideContent } = useHold();
  const lenis = useLenis();
  const { lock } = useScrollLock();
  const rangeRef = useRef(range);
  const apiRef = useRef(lenis);
  const white = useRef<Array<HTMLDivElement | null>>([]);
  const ink = useRef<Array<HTMLDivElement | null>>([]);
  const washWhite = useRef<HTMLDivElement>(null);
  const washInk = useRef<HTMLDivElement>(null);
  const state = useRef<LiquidState>({
    p: 0,
    pa: 0,
    side: "registry",
    started: false,
    busy: false,
    white: 0,
    whiteDrain: 0,
    black: 0,
    blackDrain: 0,
    tl: null,
    unlock: null,
    jumped: false,
  });
  /** The logic, built in the effect below (it needs the elements and the hold). */
  const feed = useRef<(p: number) => void>(() => undefined);

  useEffect(() => {
    rangeRef.current = range;
    apiRef.current = lenis;
  });

  useEffect(() => {
    const s = state.current;

    /** Draws one liquid: its blobs and its solid wash. Returns whether it has reached the top corner. */
    const drawSet = (
      set: readonly Blob[],
      els: Array<HTMLDivElement | null>,
      wash: HTMLDivElement | null,
      v: number,
      drain: number,
    ): { reached: boolean; grow: number } => {
      const clock = shapeClock(v);
      const grow = 1 - drain;
      set.forEach((b, i) => {
        const el = els[i];
        const e = easeInOut(seg(clock, b.a, b.b));
        const scale = (0.03 + b.k * e) * grow;
        put(el, "visibility", e > 0.001 && scale > 0.02 ? "visible" : "hidden");
        put(
          el,
          "transform",
          `translate3d(${String(b.x)}vw,${String(b.y)}vh,0) rotate(${(b.rot * e).toFixed(2)}deg) scale(${scale.toFixed(4)})`,
        );
      });
      const w = seg(clock, 0.66, 0.8) * grow;
      put(wash, "opacity", w.toFixed(3));
      put(wash, "visibility", w > 0.001 ? "visible" : "hidden");
      // The liquid reaches the top corner (where the nav text is) when the edge of its rim blob,
      // which is the biggest of the plain ones, is as far from the middle as the corner is.
      const rim = set[1];
      let reached = false;
      if (rim) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const size = 0.62 * Math.max(vw, vh);
        const radius = 0.38 * size * (0.03 + rim.k * easeInOut(seg(clock, rim.a, rim.b))) * 0.92;
        reached = radius >= Math.hypot(vw / 2 - 130, vh / 2 - 40);
      }
      return { reached, grow };
    };

    const draw = () => {
      const w = drawSet(WHITE, white.current, washWhite.current, s.white, s.whiteDrain);
      const k = drawSet(INK, ink.current, washInk.current, s.black, s.blackDrain);
      // The nav text follows what the corner is on: the pale liquid (dark text) or the black one.
      toneHint.set(
        w.reached && w.grow > 0.55 ? "light" : k.reached && k.grow > 0.55 ? "dark" : null,
      );
    };

    const sync = (side: Side, p: number) => {
      s.side = side;
      s.jumped = false;
      if (side === "film") {
        hideContent(true);
        s.white = 1;
        s.whiteDrain = 1;
        s.black = blackAt(p);
        s.blackDrain = 0;
      } else {
        hideContent(false);
        filmArrive.set(false);
        s.white = whiteAt(p);
        s.whiteDrain = 0;
        s.black = 0;
        s.blackDrain = 0;
      }
      draw();
    };

    /** Gives the scroll back and leaves the join at rest. */
    const finish = () => {
      s.tl?.kill();
      s.tl = null;
      if (s.side === "film") {
        s.whiteDrain = 1;
        s.black = 0;
        s.blackDrain = 0;
      } else {
        s.white = 0;
        s.whiteDrain = 0;
        s.black = 0;
        s.blackDrain = 0;
      }
      draw();
      // If the layout changed while the page was covered (the window was resized, pictures arrived),
      // the place it jumped to is no longer the start of the section: it goes to the right place now.
      const r = rangeRef.current();
      if (r && s.jumped) {
        const want = s.side === "film" ? r.end : r.start;
        if (Math.abs(window.scrollY - want) > 2) apiRef.current.scrollTo(want, { immediate: true });
      }
      s.busy = false;
      const un = s.unlock;
      s.unlock = null;
      un?.();
    };

    const jumpTo = (where: "start" | "end") => {
      const r = rangeRef.current();
      if (!r) return;
      s.jumped = true;
      apiRef.current.scrollTo(where === "end" ? r.end : r.start, { immediate: true });
      s.p = where === "end" ? 1 : 0;
      s.pa = s.p;
    };

    /** The white liquid has covered the page going down: lock, go to the film, drain, give back. */
    const arriveDown = () => {
      s.busy = true;
      s.side = "film";
      s.jumped = false;
      s.unlock = lock();
      s.tl?.kill();
      const tl = gsap.timeline({ onComplete: finish });
      s.tl = tl;
      // A hurried scroll can get here before the liquid has quite come: it finishes covering first.
      if (s.white < 0.995) {
        tl.to(s, {
          white: 1,
          duration: 0.06 + 0.28 * (1 - s.white),
          ease: "power1.out",
          onUpdate: draw,
        });
      }
      tl.call(() => {
        s.black = 0;
        s.blackDrain = 0;
        hideContent(true);
        filmArrive.set(true);
        jumpTo("end");
        draw();
      });
      tl.to(
        s,
        { whiteDrain: 1, duration: DRAIN, ease: "power2.inOut", onUpdate: draw },
        `+=${String(DRAIN_DELAY)}`,
      );
      tl.to({}, { duration: SETTLE });
    };

    /** The black liquid has covered the page going back: lock, go to the registry, drain, give back. */
    const arriveUp = () => {
      s.busy = true;
      s.side = "registry";
      s.jumped = false;
      s.unlock = lock();
      s.tl?.kill();
      const tl = gsap.timeline({ onComplete: finish });
      s.tl = tl;
      if (s.black < 0.995) {
        tl.to(s, {
          black: 1,
          duration: 0.06 + 0.28 * (1 - s.black),
          ease: "power1.out",
          onUpdate: draw,
        });
      }
      tl.call(() => {
        s.white = 0;
        s.whiteDrain = 0;
        hideContent(false);
        filmArrive.set(false);
        jumpTo("start");
        draw();
      });
      tl.to(
        s,
        { blackDrain: 1, duration: DRAIN, ease: "power2.inOut", onUpdate: draw },
        `+=${String(DRAIN_DELAY)}`,
      );
      tl.to({}, { duration: SETTLE });
    };

    feed.current = (p) => {
      const r = rangeRef.current();
      const len = r ? r.end - r.start : 2000;
      const pa = r ? (window.scrollY - r.start) / len : p;
      s.p = p;
      s.pa = pa;
      if (s.busy) return;
      if (!s.started) {
        // A reload part way down, or the page opened here: it is taken as it is.
        s.started = true;
        sync(sideAt(pa, len), p);
        return;
      }
      if (s.side === "registry") {
        if (sideAt(pa, len) === "film") {
          if (arrivesDown(pa)) arriveDown();
          else sync("film", p);
        } else {
          s.white = whiteAt(p);
          s.black = 0;
          draw();
        }
      } else if (blackCovers(pa, len)) {
        // The black liquid has covered the page (the stop of a snap lands exactly on this point too).
        if (arrivesUp(pa)) arriveUp();
        else sync("registry", p);
      } else {
        s.black = blackAt(p);
        draw();
      }
    };

    // A tab that is hidden does not play its animations: finish at once, whole, so nothing is left
    // locked or half done when it comes back.
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !s.busy) return;
      s.tl?.kill();
      if (!s.jumped) {
        if (s.side === "film") {
          hideContent(true);
          filmArrive.set(true);
          jumpTo("end");
        } else {
          hideContent(false);
          filmArrive.set(false);
          jumpTo("start");
        }
      }
      if (s.side === "film") s.whiteDrain = 1;
      else s.blackDrain = 1;
      finish();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      feed.current = () => undefined;
      s.tl?.kill();
      s.tl = null;
      s.busy = false;
      const un = s.unlock;
      s.unlock = null;
      un?.();
      filmArrive.set(false);
      toneHint.set(null);
    };
  }, [hideContent, lock]);

  useHoldProgress((p) => {
    feed.current(p);
  });

  // Never left half way, and a second of quiet is enough: going down the white liquid, going back
  // the black one. The stretch of each is snapped on its own (a half goes on).
  useScrollSnap(
    "liquid",
    () => {
      const r = rangeRef.current();
      const s = state.current;
      return r && s.side === "registry" && !s.busy
        ? { start: r.start, end: r.start + DONE * (r.end - r.start) }
        : null;
    },
    { idleMs: 1000, snapSeconds: 0.6 },
  );
  useScrollSnap(
    "liquid:back",
    () => {
      const r = rangeRef.current();
      const s = state.current;
      // The range runs backwards: it starts at the film in place and ends where the page is covered.
      return r && s.side === "film" && !s.busy
        ? { start: r.end, end: r.start + DONE * (r.end - r.start) }
        : null;
    },
    { idleMs: 1000, snapSeconds: 0.6 },
  );

  return (
    <div className={styles.liquid} aria-hidden="true">
      <div ref={washWhite} className={styles.wash} />
      {WHITE.map((b, i) => (
        <Shape
          key={`w${String(i)}`}
          blob={b}
          refFn={(el) => {
            white.current[i] = el;
          }}
        />
      ))}
      <div ref={washInk} className={styles.washInk} />
      {INK.map((b, i) => (
        <Shape
          key={`k${String(i)}`}
          blob={b}
          refFn={(el) => {
            ink.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

function Shape({ blob, refFn }: { blob: Blob; refFn: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={refFn} className={styles.blob} data-tone={blob.tone} data-extra={blob.extra}>
      <svg className={styles.shape} viewBox="-50 -50 100 100" focusable="false">
        <path d={blob.d} />
      </svg>
    </div>
  );
}
