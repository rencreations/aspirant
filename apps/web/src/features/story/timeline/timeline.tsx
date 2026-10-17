"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import { Frame } from "@/components/frame/frame";
import type { FrameShape } from "@/components/frame/frame-shapes";
import { useLenis } from "@/components/smooth-scroll";
import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { timeOrder } from "@/content/world";
import { audio } from "@/lib/audio";
import { useMediaQuery, useReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";
import { routes } from "@/lib/site";

import { ChapterLink } from "../chapter-link";
import { SectionHead } from "../section-head";
import styles from "./timeline.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const SHAPES: readonly FrameShape[] = ["chamfer", "ticket"];

/** Up to four chapters get a chip each; a longer run gets its first and last. */
function chipIds(ids: readonly string[]): readonly string[] {
  const unique = Array.from(new Set(ids));
  if (unique.length <= 4) return unique;
  const first = unique[0];
  const last = unique[unique.length - 1];
  return first && last ? [first, last] : unique;
}

/**
 * The story in time order. On a wide screen the page pins and scrolling moves the timeline
 * sideways (one page pixel is one timeline pixel), and you can also drag it, use the arrow
 * keys or the previous and next buttons. On a phone the stops stack. With reduced motion the
 * timeline is an ordinary sideways scroller with the same buttons.
 */
export function Timeline() {
  const pinRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const stopRefs = useRef<Array<HTMLLIElement | null>>([]);
  const { scrollTo } = useLenis();
  const wide = useMediaQuery("(min-width: 48em)");
  const reduced = useReducedMotion();
  const mode = !wide ? "stack" : reduced ? "native" : "pinned";
  const [active, setActive] = useState(0);
  const travel = useRef(0);
  const drag = useRef({ on: false, x: 0, moved: 0 });

  const setProgress = useCallback((p: number) => {
    pinRef.current?.style.setProperty("--tp", p.toFixed(4));
  }, []);

  const nearest = useCallback((left: number) => {
    let best = 0;
    let bestD = Infinity;
    stopRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = Math.abs(el.offsetLeft - 24 - left);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }, []);

  // Measure how far the track travels and size the pinned region to match.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const pin = pinRef.current;
    if (!scroller || !pin || mode !== "pinned") return;
    const measure = () => {
      travel.current = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      pin.style.setProperty("--travel", `${travel.current}px`);
      ScrollTrigger.refresh();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => {
      ro.disconnect();
      pin.style.removeProperty("--travel");
    };
  }, [mode]);

  // Vertical scroll drives the sideways travel.
  useGSAP(
    () => {
      const pin = pinRef.current;
      const scroller = scrollerRef.current;
      if (!pin || !scroller || mode !== "pinned") return;
      const trigger = ScrollTrigger.create({
        trigger: pin,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          scroller.scrollLeft = self.progress * travel.current;
          setProgress(self.progress);
          const i = nearest(scroller.scrollLeft);
          setActive((prev) => (prev === i ? prev : i));
        },
      });
      return () => {
        trigger.kill();
        scroller.scrollLeft = 0;
      };
    },
    { scope: pinRef, dependencies: [mode, nearest, setProgress] },
  );

  // Native mode keeps its own position.
  const onNativeScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || mode === "pinned") return;
    const max = Math.max(1, scroller.scrollWidth - scroller.clientWidth);
    setProgress(scroller.scrollLeft / max);
    setActive(nearest(scroller.scrollLeft));
  };

  const goTo = (index: number) => {
    const i = clamp(index, 0, timeOrder.length - 1);
    const scroller = scrollerRef.current;
    const pin = pinRef.current;
    const stop = stopRefs.current[i];
    if (!scroller || !stop) return;
    audio.blip("click");
    if (mode === "pinned" && pin) {
      const left = clamp(stop.offsetLeft - 24, 0, travel.current);
      const top = pin.getBoundingClientRect().top + window.scrollY;
      scrollTo(top + left, { duration: 0.9 });
    } else if (mode === "native") {
      scroller.scrollTo({ left: stop.offsetLeft - 24, behavior: reduced ? "auto" : "smooth" });
    } else {
      stop.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    }
    setActive(i);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const next =
      e.key === "ArrowRight"
        ? active + 1
        : e.key === "ArrowLeft"
          ? active - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? timeOrder.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    goTo(next);
  };

  // Drag: sideways pointer movement moves the page (pinned) or the scroller (native).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (mode === "stack" || (e.pointerType === "touch" && mode === "native")) return;
    if ((e.target as HTMLElement).closest("a, button")) return;
    drag.current = { on: true, x: e.clientX, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    d.moved += Math.abs(dx);
    if (mode === "pinned") scrollTo(window.scrollY - dx, { immediate: true });
    else scrollerRef.current?.scrollBy({ left: -dx });
  };
  const onPointerUp = () => {
    drag.current.on = false;
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (mode !== "pinned") return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY))
      scrollTo(window.scrollY + e.deltaX, { immediate: true });
  };

  const total = timeOrder.length;

  return (
    <ThemeZone theme="daybreak" aria-labelledby="timeline-title" className={styles.section}>
      <section>
        <div className="shell">
          <SectionHead
            id="timeline-title"
            code="06 / In time order"
            title="The story, in order"
            lead="From the breaking of the Twilight Orb to the night nobody knows how it ends."
          />
          <p className={styles.note}>
            <span className="hud-label">Read me first</span>
            <span>
              The book is told out of order, and flashbacks announce themselves. This page lines the
              same events up by when they happened. The reader in{" "}
              <TLink href={routes.experience} className="link">
                Experience
              </TLink>{" "}
              follows the book.
            </span>
          </p>
        </div>

        <div
          ref={pinRef}
          className={styles.pin}
          data-mode={mode}
          style={{ "--tp": 0 } as CSSProperties}
        >
          <div className={styles.sticky}>
            <div className={`${styles.controls} shell`}>
              <p className={`${styles.counter} hud-label`} aria-live="polite">
                Stop {String(active + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}
              </p>
              <div className={styles.rail} aria-hidden="true">
                <span className={styles.railFill} />
                {timeOrder.map((row, i) => (
                  <span
                    key={row.when}
                    className={styles.railTick}
                    data-on={i <= active}
                    style={{ left: `${(i / (total - 1)) * 100}%` }}
                  />
                ))}
              </div>
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={styles.step}
                  aria-label="Previous stop"
                  disabled={active === 0}
                  onClick={() => goTo(active - 1)}
                >
                  <span aria-hidden="true">&larr;</span>
                </button>
                <button
                  type="button"
                  className={styles.step}
                  aria-label="Next stop"
                  disabled={active === total - 1}
                  onClick={() => goTo(active + 1)}
                >
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>
            </div>

            <div
              ref={scrollerRef}
              className={styles.scroller}
              role="region"
              aria-label="Timeline in time order. Use the arrow keys to move between stops."
              tabIndex={mode === "stack" ? -1 : 0}
              onKeyDown={onKey}
              onScroll={onNativeScroll}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
              data-cursor={mode === "stack" ? undefined : "DRAG"}
            >
              <ol ref={trackRef} className={styles.track}>
                {timeOrder.map((row, i) => (
                  <li
                    key={`${row.when}-${i}`}
                    ref={(el) => {
                      stopRefs.current[i] = el;
                    }}
                    className={styles.stop}
                    data-on={i === active}
                    data-low={i % 2 === 1}
                  >
                    <span className={styles.node} aria-hidden="true" />
                    <Frame
                      shape={SHAPES[i % SHAPES.length] ?? "chamfer"}
                      tilt={mode !== "stack"}
                      maxTilt={4}
                      label={`STOP ${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
                      className={styles.frame}
                      mediaClassName={styles.media}
                    >
                      <div className={styles.card}>
                        <p className={`${styles.when} display`}>{row.when}</p>
                        <p className={styles.what}>{row.what}</p>
                        <div className={styles.chapters}>
                          <p className={`${styles.chLabel} hud-label`}>Chapters {row.chapters}</p>
                          <ul className={styles.chips}>
                            {chipIds(row.chapterIds).map((id) => (
                              <li key={id}>
                                <ChapterLink id={id} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Frame>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
    </ThemeZone>
  );
}
