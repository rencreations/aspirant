"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Route } from "next";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";

import { FIGURES } from "../media";
import { facesGate } from "../seams/gates";
import styles from "./faces.module.css";
import { STORY_DEPTH, StoryWord } from "./story-word";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

type Side = "academic" | "ender";

interface Face {
  side: Side;
  kicker: string;
  title: string;
  text: string;
  href: Route;
  label: string;
  src: string;
}

const FACES: readonly Face[] = [
  {
    side: "academic",
    kicker: "Part one",
    title: "Human",
    text: "A gate in the rain, a broom cupboard, a doughnut and a gold star. How she came to stand behind Guinevere.",
    href: "/character/vexana/story/academic",
    label: "Read the Human story. Vexana in her Academy uniform, looking right.",
    src: FIGURES.normalSide,
  },
  {
    side: "ender",
    kicker: "Part two",
    title: "Ender",
    text: "A black gate, the void and a lie told for love. What she did after the Enders took her.",
    href: "/character/vexana/story/ender",
    label: "Read the Ender story. Vexana in her Ender form, looking left.",
    src: FIGURES.enderSide,
  },
];

/** How far the page scrolls, in screens, while the section is held in place. */
const HOLD = 1.7;

/** Splits a word into letters that rise one after the other once the section has begun. */
function Letters({ text, from }: { text: string; from: number }) {
  return (
    <span className={styles.line} aria-hidden="true">
      {[...text].map((c, i) => (
        <span key={i} className={styles.ch} style={{ "--i": from + i } as CSSProperties}>
          {c}
        </span>
      ))}
    </span>
  );
}

/**
 * The pair of faces, waist up. Her human self fills the left half of the screen and her Ender
 * self the right half, and each half is one big link to its half of the story.
 *
 * When the section is about to come into view nothing is on it. The two figures then arrive from
 * their own edges, zoomed in tight and easing out to rest (one a moment after the other), a soft
 * pool of colour opens behind each, and the titles rise letter by letter. Then the section is held
 * in place (a sticky stage inside a tall track) while the page scrolls about 1.7 screens: the two
 * lean toward each other and push in a little. The track keeps one more screen after that, where the
 * next section (the interlude) rises over the held stage by plain scrolling, with no script involved
 * (it overlaps this track by that screen: see `.cover` in cover.module.css).
 *
 * Only `transform` and `opacity` move. Reduced motion shows the finished picture, and the hold is
 * dropped.
 */
export function Faces({ gated = false }: { gated?: boolean }) {
  const reduced = useReducedMotion();
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const enters = useRef<Array<HTMLSpanElement | null>>([null, null]);
  const halos = useRef<Array<HTMLSpanElement | null>>([null, null]);
  const pushes = useRef<Array<HTMLSpanElement | null>>([null, null]);
  const figs = useRef<Array<HTMLSpanElement | null>>([null, null]);
  const cols = useRef<Array<HTMLSpanElement | null>>([null, null]);
  const rings = useRef<SVGSVGElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const letterPar = useRef<Array<HTMLSpanElement | null>>([]);
  const letterRip = useRef<Array<HTMLSpanElement | null>>([]);
  const [active, setActive] = useState<Side | null>(null);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0 });

  // The entrance, and the lean while the section is held.
  useEffect(() => {
    const root = track.current;
    const st = stage.current;
    if (!root || !st) return;
    if (reduced) {
      root.dataset.in = "true";
      return;
    }
    root.dataset.armed = "1";
    root.dataset.in = "false";
    const e = enters.current;
    const h = halos.current;
    const pu = pushes.current;
    const rg = rings.current;
    const wd = word.current;
    const from = (i: number) => (i === 0 ? -1 : 1);

    const tl = gsap.timeline({ paused: true });
    // The pool of colour opens first, slowly.
    tl.fromTo(
      h,
      { autoAlpha: 0, scale: 0.5 },
      { autoAlpha: 1, scale: 1, duration: 2.6, ease: "expo.out", stagger: 0.2 },
      0,
    );
    // The figures slide in from their edges, zoomed in tight, and ease out to rest (no overshoot).
    tl.fromTo(
      e,
      {
        xPercent: (i: number) => from(i) * 42,
        yPercent: 3,
        scale: 1.34,
        transformOrigin: (i: number) => (i === 0 ? "76% 21%" : "17% 27%"),
      },
      { xPercent: 0, yPercent: 0, scale: 1, duration: 2.8, ease: "expo.out", stagger: 0.24 },
      0.05,
    );
    // They show sooner than they settle.
    tl.fromTo(
      e,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 1.1, ease: "power2.out", stagger: 0.24 },
      0.05,
    );
    // The words follow once the figures are well on the way.
    tl.call(
      () => {
        root.dataset.in = "true";
      },
      [],
      0.7,
    );

    const lean = (p: number) => {
      const k = p * p * (3 - 2 * p);
      for (const [i, el] of pu.entries()) {
        if (!el) continue;
        el.style.transform = `translate3d(${(from(i) * -k * 1.2).toFixed(3)}vw,${(-k * 1).toFixed(3)}svh,0) scale(${(1 + k * 0.045).toFixed(4)})`;
      }
      if (rg) rg.style.transform = `translate3d(${(-k * 4).toFixed(3)}vw,0,0)`;
      // The big word drifts up and fades a little while the section is held.
      if (wd) {
        wd.style.transform = `translate3d(0,${(-k * 5).toFixed(3)}svh,0)`;
        wd.style.opacity = (1 - k * 0.55).toFixed(3);
      }
      root.dataset.hint = p > 0.12 ? "true" : "false";
    };

    const begin = () => {
      tl.play();
    };
    const rewind = () => {
      tl.pause(0);
      root.dataset.in = "false";
    };
    // Gated: the doors in front of the section throw the switch when they have closed, and the pair
    // arrives from the two sides then. Otherwise it begins when the section is about to be seen.
    const entry = gated
      ? null
      : ScrollTrigger.create({
          trigger: root,
          start: "top 62%",
          onEnter: begin,
          onLeaveBack: rewind,
        });
    const unsubscribe = gated
      ? facesGate.subscribe((on) => {
          if (on) begin();
          else rewind();
        })
      : null;
    if (gated && facesGate.get()) tl.progress(1);
    const hold = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: () => `+=${st.offsetHeight * HOLD}`,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        lean(self.progress);
      },
    });
    // Loaded below the section (a reload part way down the page): show it finished.
    if (entry && entry.progress > 0 && !tl.isActive()) {
      tl.progress(1);
      root.dataset.in = "true";
    }
    lean(hold.progress);

    return () => {
      entry?.kill();
      unsubscribe?.();
      hold.kill();
      tl.kill();
      delete root.dataset.armed;
      delete root.dataset.in;
      delete root.dataset.hint;
      for (const el of [...e, ...h, ...pu]) {
        if (el) {
          gsap.set(el, { clearProps: "all" });
          el.style.transform = "";
        }
      }
      if (rg) rg.style.transform = "";
      if (wd) {
        wd.style.transform = "";
        wd.style.opacity = "";
      }
    };
  }, [reduced, gated]);

  // The pointer parallax: a loop that runs only while the picture is catching up with the pointer.
  useEffect(() => {
    const p = pointer.current;
    const el = stage.current;
    if (!el || reduced) return;
    const apply = () => {
      for (const [i, f] of figs.current.entries()) {
        if (f)
          f.style.transform = `translate3d(${(p.x * (i ? 1 : -1) * -18).toFixed(2)}px,${(p.y * -10).toFixed(2)}px,0)`;
      }
      for (const [i, c] of cols.current.entries()) {
        if (c)
          c.style.transform = `translate3d(${(p.x * (i ? 1 : -1) * 8).toFixed(2)}px,${(p.y * 5).toFixed(2)}px,0)`;
      }
      for (const [i, l] of letterPar.current.entries()) {
        if (l) {
          const d = STORY_DEPTH[i] ?? 0.6;
          l.style.transform = `translate3d(${(p.x * -26 * d).toFixed(2)}px,${(p.y * -14 * d).toFixed(2)}px,0)`;
        }
      }
    };
    const tick = () => {
      p.x += (p.tx - p.x) * 0.075;
      p.y += (p.ty - p.y) * 0.075;
      apply();
      if (Math.abs(p.tx - p.x) > 0.002 || Math.abs(p.ty - p.y) > 0.002) {
        p.raf = requestAnimationFrame(tick);
      } else {
        p.raf = 0;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      p.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      p.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!p.raf) p.raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      p.tx = 0;
      p.ty = 0;
      if (!p.raf) p.raf = requestAnimationFrame(tick);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(p.raf);
      p.raf = 0;
    };
  }, [reduced]);

  // A press ripples the letters of the big word, one after the other.
  const ripple = () => {
    if (reduced) return;
    for (const [i, el] of letterRip.current.entries()) {
      el?.animate(
        [
          { transform: "translate3d(0,0,0)" },
          { transform: "translate3d(0,-9%,0)", offset: 0.4 },
          { transform: "translate3d(0,0,0)" },
        ],
        { duration: 760, delay: i * 70, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  };

  const hover = (side: Side | null) => (e: { pointerType?: string }) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    setActive(side);
  };

  return (
    <section
      id="faces"
      ref={track}
      className={styles.track}
      data-active={active ?? "none"}
      aria-labelledby="faces-title"
    >
      <div ref={stage} className={styles.stage} onPointerDown={ripple}>
        <h2 id="faces-title" className={styles.sr}>
          Read her story in two parts
        </h2>
        <div className={styles.bg} aria-hidden="true">
          <svg
            ref={rings}
            viewBox="0 0 1600 900"
            preserveAspectRatio="xMidYMid slice"
            className={styles.rings}
          >
            <g fill="none" stroke="currentColor" strokeWidth="1.1">
              <path d="M-160 640C80 520 230 760 460 700s330-260 560-190 330 170 560 40 330-120 560-60" />
              <path d="M-160 690C70 580 240 810 470 750s330-250 560-180 330 160 560 30 330-110 560-50" />
              <path d="M-160 740C60 640 250 860 480 800s330-240 560-170 330 150 560 20 330-100 560-40" />
              <path d="M-160 250C50 150 230 330 460 270s330-200 560-130 330 90 560-20 330-60 560 0" />
              <path d="M-160 300C40 210 240 380 470 320s330-190 560-120 330 80 560-30 330-50 560 10" />
            </g>
          </svg>
        </div>

        <StoryWord wordRef={word} parRefs={letterPar} ripRefs={letterRip} />

        {FACES.map((f, i) => (
          <TLink
            key={f.side}
            href={f.href}
            transitionLabel={f.title}
            className={styles.zone}
            data-side={f.side}
            data-cursor="READ"
            aria-label={f.label}
            onPointerEnter={hover(f.side)}
            onPointerLeave={hover(null)}
            onFocus={() => setActive(f.side)}
            onBlur={() => setActive(null)}
          >
            <span
              className={styles.halo}
              aria-hidden="true"
              ref={(el) => {
                halos.current[i] = el;
              }}
            />
            <span className={styles.fig} aria-hidden="true">
              <span
                className={styles.enter}
                ref={(el) => {
                  enters.current[i] = el;
                }}
              >
                <span
                  className={styles.push}
                  ref={(el) => {
                    pushes.current[i] = el;
                  }}
                >
                  <span
                    className={styles.par}
                    ref={(el) => {
                      figs.current[i] = el;
                    }}
                  >
                    {/* Plain <img>: static export, a transparent cut-out. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.img}
                      src={asset(f.src)}
                      alt=""
                      width={1086}
                      height={1448}
                      draggable={false}
                      decoding="async"
                    />
                  </span>
                </span>
              </span>
            </span>

            <span className={styles.col}>
              <span
                className={styles.colPar}
                ref={(el) => {
                  cols.current[i] = el;
                }}
              >
                <span className={styles.kicker}>{f.kicker}</span>
                <span className={styles.title} role="presentation">
                  <Letters text={f.title.toUpperCase()} from={i * 3} />
                </span>
                <span className={styles.text}>{f.text}</span>
              </span>
            </span>
          </TLink>
        ))}

        <p className={styles.hint} aria-hidden="true">
          <span className={styles.hintFine}>Choose a side</span>
          <span className={styles.hintCoarse}>Tap a side</span>
        </p>
      </div>
    </section>
  );
}
