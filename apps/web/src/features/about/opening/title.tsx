"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from "react";

import { useMounted } from "@/lib/hooks";

import { stageRefs, useAboutStage, type TitleReveal } from "../stage-bus";
import { BANDS, bandEdge, tickAt } from "./geometry";
import styles from "./title.module.css";

/** The lean of the bands' cut, the same as the slant of the display face. */
const SLANT = 11;

interface ArtProps {
  className: string | undefined;
  aboutRef?: Ref<HTMLSpanElement>;
  aspirantRef?: Ref<HTMLSpanElement>;
}

/** The two words as they are drawn: the giant ABOUT, and Aspirant across its lower right. */
function Art({ className, aboutRef, aspirantRef }: ArtProps) {
  return (
    <span className={className} aria-hidden="true">
      <span ref={aboutRef} className={`${styles.about} display`}>
        About
      </span>
      <span ref={aspirantRef} className={`${styles.aspirant} serif`}>
        Aspirant
      </span>
    </span>
  );
}

/**
 * The title of the page, and its side of the opening. The drone crosses it from right to left and
 * the title appears in its trail: it is cut into rows, and each row is a window that opens from
 * the right, a little behind the drone and by its own length, so the edge of what shows is a comb
 * of streaks. A row is two nested boxes that move by the same amount in opposite ways, so the
 * letters themselves never move and nothing but transform is written. When the pass is over the
 * rows are taken away and the plain title stands.
 *
 * What is hidden when is in the stylesheet, by the phase on the page root.
 */
export function Title() {
  const root = useRef<HTMLHeadingElement>(null);
  const about = useRef<HTMLSpanElement>(null);
  const aspirant = useRef<HTMLSpanElement>(null);
  const region = useRef<HTMLSpanElement>(null);
  const windows = useRef<Array<HTMLSpanElement | null>>([]);
  const copies = useRef<Array<HTMLSpanElement | null>>([]);
  const ticks = useRef<Array<HTMLSpanElement | null>>([]);
  /** The rows exist from the mount until the title is whole: they are not in the server's page. */
  const live = useMounted();
  const [finished, setFinished] = useState(false);
  const over = useAboutStage((s) => s.phase === "done");

  useLayoutEffect(() => {
    /** The title's left and width and the rows' own left, in the viewport. Measured when needed. */
    let geo: { left: number; width: number; origin: number } | null = null;
    const forget = () => {
      geo = null;
    };

    const rect = () => {
      const a = about.current?.getBoundingClientRect();
      const b = aspirant.current?.getBoundingClientRect();
      if (!a || !b) return root.current?.getBoundingClientRect() ?? new DOMRect();
      const left = Math.min(a.left, b.left);
      const top = Math.min(a.top, b.top);
      return new DOMRect(
        left,
        top,
        Math.max(a.right, b.right) - left,
        Math.max(a.bottom, b.bottom) - top,
      );
    };

    const handle: TitleReveal = {
      rect,
      setEdge: (x) => {
        const box = region.current;
        if (!box) return;
        if (!geo) {
          const r = rect();
          geo = { left: r.left, width: r.width, origin: box.getBoundingClientRect().left };
        }
        const dpr = window.devicePixelRatio || 1;
        // The marks on the rows' edges go out as the drone reaches the left end.
        const mark = tickAt(x, geo.left, geo.width).toFixed(3);
        for (let i = 0; i < BANDS; i += 1) {
          // Whole device pixels, and the same number both ways, so the letters stand still.
          const dx = Math.round((bandEdge(i, x, geo.left, geo.width) - geo.origin) * dpr) / dpr;
          const w = windows.current[i];
          const c = copies.current[i];
          if (!w || !c) continue;
          w.style.transform = `translate3d(${dx}px, 0, 0) skewX(${-SLANT}deg)`;
          c.style.transform = `skewX(${SLANT}deg) translate3d(${-dx}px, 0, 0)`;
          const t = ticks.current[i];
          if (t) t.style.opacity = mark;
        }
      },
      finish: () => {
        setFinished(true);
      },
    };

    stageRefs.title = handle;
    window.addEventListener("resize", forget);
    return () => {
      window.removeEventListener("resize", forget);
      if (stageRefs.title === handle) stageRefs.title = null;
    };
  }, []);

  const whole = finished || over;

  return (
    <h1 ref={root} id="about-title" className={styles.title} data-finished={whole ? "" : undefined}>
      <span className={styles.name}>About Aspirant</span>
      <Art className={styles.art} aboutRef={about} aspirantRef={aspirant} />
      {live && !whole ? (
        <span
          ref={region}
          className={styles.bands}
          style={{ "--bands": BANDS } as CSSProperties}
          aria-hidden="true"
        >
          {Array.from({ length: BANDS }, (_, i) => (
            <span
              key={i}
              ref={(el) => {
                windows.current[i] = el;
              }}
              className={styles.band}
              style={{ "--i": i } as CSSProperties}
            >
              <span
                ref={(el) => {
                  copies.current[i] = el;
                }}
                className={styles.copy}
              >
                <Art className={styles.copyArt} />
              </span>
              <span
                ref={(el) => {
                  ticks.current[i] = el;
                }}
                className={styles.tick}
              />
            </span>
          ))}
        </span>
      ) : null}
    </h1>
  );
}
