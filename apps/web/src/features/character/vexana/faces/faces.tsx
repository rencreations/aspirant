"use client";

import type { Route } from "next";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { FIGURES } from "../media";
import styles from "./faces.module.css";

type Side = "academic" | "ender";

interface Face {
  side: Side;
  kicker: string;
  title: string;
  text: string;
  href: Route;
  label: string;
  src: string;
  alt: string;
}

const FACES: readonly Face[] = [
  {
    side: "academic",
    kicker: "Part one",
    title: "Academic",
    text: "A gate in the rain, a broom cupboard, a doughnut and a gold star. How she came to stand behind Guinevere.",
    href: "/character/vexana/story/academic",
    label: "Read the Academic story",
    src: FIGURES.normalSide,
    alt: "Vexana in her Academy uniform, in profile, looking right.",
  },
  {
    side: "ender",
    kicker: "Part two",
    title: "Ender",
    text: "A black gate, the void and a lie told for love. What she did after the Enders took her.",
    href: "/character/vexana/story/ender",
    label: "Read the Ender story",
    src: FIGURES.enderSide,
    alt: "Vexana in her Ender form, in profile, looking left.",
  },
];

/** Splits a word into letters that rise one after the other once the section is in view. */
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
 * The pair of faces. Her Academy self on the left and her Ender self on the right look at each
 * other across two huge titles, and each has a button to its half of the story. They slide in from
 * the edges when the section comes into view, breathe, follow the pointer a little, and when one
 * side is pointed at the other steps back.
 */
export function Faces() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const figs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const cols = useRef<Array<HTMLDivElement | null>>([null, null]);
  const seen = useInView(root, { threshold: 0.3, once: true });
  const [active, setActive] = useState<Side | null>(null);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0 });

  // The pointer parallax: a loop that runs only while the picture is catching up with the pointer.
  useEffect(() => {
    const p = pointer.current;
    const el = root.current;
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

  const hover = (side: Side | null) => (e: { pointerType?: string }) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    setActive(side);
  };

  return (
    <section
      id="faces"
      ref={root}
      className={styles.section}
      data-in={seen || reduced}
      data-active={active ?? "none"}
      aria-labelledby="faces-title"
    >
      <h2 id="faces-title" className={styles.sr}>
        Read her story in two parts
      </h2>
      <div className={styles.bg} aria-hidden="true">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={styles.rings}>
          <g fill="none" stroke="currentColor" strokeWidth="1.1">
            <path d="M-60 640C180 520 330 760 560 700s330-260 560-190 330 170 560 40" />
            <path d="M-60 690C170 580 340 810 570 750s330-250 560-180 330 160 560 30" />
            <path d="M-60 740C160 640 350 860 580 800s330-240 560-170 330 150 560 20" />
            <path d="M-60 250C150 150 330 330 560 270s330-200 560-130 330 90 560-20" />
            <path d="M-60 300C140 210 340 380 570 320s330-190 560-120 330 80 560-30" />
          </g>
        </svg>
      </div>

      {FACES.map((f, i) => (
        <div
          key={f.side}
          className={styles.zone}
          data-side={f.side}
          onPointerEnter={hover(f.side)}
          onPointerLeave={hover(null)}
        >
          <div className={styles.fig}>
            <div
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
                alt={f.alt}
                width={1086}
                height={1448}
                draggable={false}
                decoding="async"
              />
            </div>
          </div>
        </div>
      ))}

      <div className={styles.center}>
        {FACES.map((f, i) => (
          <div
            key={f.side}
            className={styles.col}
            data-side={f.side}
            onFocus={() => setActive(f.side)}
            onBlur={() => setActive(null)}
            onPointerEnter={hover(f.side)}
            onPointerLeave={hover(null)}
          >
            <div
              className={styles.colPar}
              ref={(el) => {
                cols.current[i] = el;
              }}
            >
              <p className={styles.kicker}>{f.kicker}</p>
              <h3 className={styles.title}>
                <span className={styles.sr}>{f.title}</span>
                <Letters text={f.title.toUpperCase()} from={i * 3} />
              </h3>
              <p className={styles.text}>{f.text}</p>
              <TLink
                href={f.href}
                transitionLabel={f.title}
                className={styles.go}
                aria-label={f.label}
                data-cursor="READ"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    d="M6 18 18 6M8 6h10v10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="square"
                  />
                </svg>
              </TLink>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
