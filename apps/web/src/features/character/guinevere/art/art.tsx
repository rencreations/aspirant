"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { ART_NAMES, artPath, artThumb, type ArtName } from "../media";
import styles from "./art.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

interface Piece {
  name: ArtName;
  title: string;
  line: string;
  alt: string;
  /** How far the frame drifts against the scroll, px. The sign sets the direction. */
  drift: number;
}

const PIECES: Record<ArtName, Piece> = {
  "vexana-splash-art": {
    name: "vexana-splash-art",
    title: "The Guardian answers",
    line: "Her Ender form, with the giant at her back.",
    alt: "Vexana in her Ender form with a giant guardian behind her, official splash art",
    drift: 70,
  },
  "both-splash-art": {
    name: "both-splash-art",
    title: "Two ways to be brave",
    line: "One stays close. One runs ahead.",
    alt: "Vexana in close profile with Guinevere dashing past, official splash art",
    drift: -90,
  },
  "guinevere-splash-art": {
    name: "guinevere-splash-art",
    title: "The brightest thing in the sky",
    line: "Guinevere, mid jump, with the drones in tow.",
    alt: "Guinevere leaping above the city with her drones, official splash art",
    drift: 50,
  },
  "fighting-stance": {
    name: "fighting-stance",
    title: "Dark and light",
    line: "Two stances that open the same sky.",
    alt: "Vexana and Guinevere in fighting stances, official art",
    drift: -60,
  },
  "fighting-moment": {
    name: "fighting-moment",
    title: "The moment they move",
    line: "Two streaks of colour, one direction.",
    alt: "Vexana and Guinevere charging forward, official art",
    drift: 40,
  },
};

const ITEMS: readonly ViewerImage[] = ART_NAMES.map((n) => ({
  src: artPath(n),
  thumb: artThumb(n),
  alt: PIECES[n].alt,
  width: 2560,
  height: 1440,
  title: PIECES[n].title,
  set: "official",
  setLabel: "Official art",
  credit: { name: "Moonton", platform: "Mobile Legends: Bang Bang" },
}));

const SIZES = "(max-width: 800px) 92vw, 56vw";

/**
 * The gallery wall: five illustrations hung at different sizes and heights, each drifting a little
 * against the scroll. The frame under the pointer comes forward, the rest sink back, and a plaque
 * rises under it. A click opens the full size in the site's viewer.
 */
export function ArtShowcase() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const wall = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const el = wall.current;
    if (!el || reduced) return;
    const frames = Array.from(el.querySelectorAll<HTMLElement>("[data-drift]"));
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        const p = self.progress - 0.5;
        for (const f of frames) {
          const d = Number(f.dataset.drift);
          f.style.transform = `translate3d(0, ${(p * d * 2).toFixed(1)}px, 0)`;
        }
      },
    });
    // Each frame fades up once as it arrives.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = "true";
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18 },
    );
    el.querySelectorAll("[data-hang]").forEach((n) => {
      io.observe(n);
    });
    return () => {
      trigger.kill();
      io.disconnect();
    };
  }, [reduced]);

  return (
    <section
      ref={root}
      id="art"
      className={styles.art}
      data-theme="storm"
      data-reduced={reduced}
      aria-labelledby="art-title"
    >
      <div className={styles.lamp} aria-hidden="true" />
      <header className={styles.head}>
        <p className={styles.kicker}>08 The gallery</p>
        <h2 id="art-title" className={styles.title}>
          <span>Our</span> <span className={styles.serif}>Artwork</span>
        </h2>
        <p className={styles.lede}>
          Five pieces of official art. Hover to bring one forward, click to see it at full size.
        </p>
      </header>

      <div ref={wall} className={styles.wall}>
        {ART_NAMES.map((n, i) => {
          const p = PIECES[n];
          return (
            <figure key={n} className={styles.slot} data-slot={i + 1} data-hang data-in={reduced}>
              <div className={styles.drift} data-drift={p.drift}>
                <button
                  type="button"
                  className={styles.frame}
                  aria-label={`Open ${p.title}`}
                  data-cursor="VIEW"
                  onPointerEnter={() => {
                    audio.blip("hover");
                  }}
                  onClick={() => {
                    setOpen(i);
                  }}
                >
                  {/* Plain <img>: static export. The small size shows first, the browser picks. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(artThumb(n))}
                    srcSet={`${asset(artThumb(n))} 960w, ${asset(artPath(n))} 2560w`}
                    sizes={SIZES}
                    alt={p.alt}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  <span className={styles.sheen} aria-hidden="true" />
                </button>
                <figcaption className={styles.plaque}>
                  <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                  <b>{p.title}</b>
                  <em>{p.line}</em>
                </figcaption>
              </div>
            </figure>
          );
        })}
      </div>

      <ImageViewer
        items={ITEMS}
        index={open}
        onIndexChange={setOpen}
        label="Guinevere's art"
        skin={{ ground: "#160e07", keyline: "#f4d4ba", accent: "#e05c57" }}
      />
    </section>
  );
}
