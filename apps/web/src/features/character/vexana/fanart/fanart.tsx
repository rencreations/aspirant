"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { fanartPath, fanartThumb } from "../media";
import { IMAGES } from "../media.generated";
import styles from "./fanart.module.css";

interface Print {
  n: number;
  title: string;
  alt: string;
  /** Tilt of the print on the wall, degrees. */
  tilt: number;
  /** How far down the wall it hangs, as a fraction of the print's own height. */
  drop: number;
}

/** Seven prints, in the order of the files. Titles are ours, not the makers'. */
const PRINTS: readonly Print[] = [
  {
    n: 1,
    title: "Best friends",
    alt: "Fanart: Guinevere and Vexana in her Ender form among sparkles, with a photo that reads Best Friends",
    tilt: -2.6,
    drop: 0,
  },
  {
    n: 2,
    title: "Two lights, one sky",
    alt: "Fanart: Guinevere with her drones below, and Vexana in her Ender form above her, in purple light",
    tilt: 1.8,
    drop: 0.12,
  },
  {
    n: 3,
    title: "Side by side",
    alt: "Fanart: Guinevere and Vexana standing together in front of the giant guardian",
    tilt: -1.4,
    drop: 0.04,
  },
  {
    n: 4,
    title: "A quiet smile",
    alt: "Fanart: Vexana in her Ender form, smiling a little, with dark blades behind her",
    tilt: 2.4,
    drop: 0.16,
  },
  {
    n: 5,
    title: "Storm of colour",
    alt: "Fanart: Vexana in her Ender form with a ball of light and the guardian behind her",
    tilt: -2,
    drop: 0.02,
  },
  {
    n: 6,
    title: "Rooftop under the moon",
    alt: "Fanart: Vexana standing on a rooftop at night, with the giant guardian and a full moon behind her",
    tilt: 1.2,
    drop: 0.1,
  },
  {
    n: 7,
    title: "Small hands, big hearts",
    alt: "Fanart: Guinevere, Vexana and a pink-haired girl with the drones, drawn in a soft style",
    tilt: -1.8,
    drop: 0.06,
  },
];

const ITEMS: readonly ViewerImage[] = PRINTS.map((p) => {
  const info = IMAGES[`fanart/fanart-${p.n}`];
  return {
    src: fanartPath(p.n),
    thumb: fanartThumb(p.n),
    alt: p.alt,
    width: info?.width ?? 1600,
    height: info?.height ?? 2000,
    title: p.title,
    set: "fanart",
    setLabel: "Fanart, made by fans",
    credit: { name: "Fans of Vexana", platform: "Fanart" },
  };
});

const SIZES = "(max-width: 700px) 46vw, (max-width: 1100px) 30vw, 22vw";

/**
 * The fan wall: seven prints pinned at slightly different heights and angles on a pale pinboard.
 * Each one drops in as it arrives. The print under the pointer lifts off the wall and straightens,
 * its pin tilts, and a click opens it in the site's viewer.
 */
export function Fanart() {
  const reduced = useReducedMotion();
  const wall = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const el = wall.current;
    if (!el) return;
    const prints = Array.from(el.querySelectorAll<HTMLElement>("[data-print]"));
    if (reduced) {
      for (const p of prints) p.dataset.in = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = "true";
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    for (const p of prints) io.observe(p);
    return () => {
      io.disconnect();
    };
  }, [reduced]);

  return (
    <section
      id="fanart"
      className={styles.root}
      data-theme="daybreak"
      aria-labelledby="fanart-title"
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <b>10</b>
          <span className={styles.bar} aria-hidden="true" />
          <span>Fanart</span>
        </p>
        <h2 id="fanart-title" className={styles.title}>
          <span>Pinned up</span>
          <span className={styles.serif}>by the fans.</span>
        </h2>
        <p className={styles.lede}>
          Seven prints, drawn by people who love her. Each one carries its artist&rsquo;s own mark.
          Hover to lift one off the wall. Click to see it large.
        </p>
      </header>

      <div ref={wall} className={styles.wall}>
        {PRINTS.map((p, i) => (
          <figure
            key={p.n}
            className={styles.slot}
            data-print
            data-in="false"
            style={
              {
                "--tilt": `${p.tilt}deg`,
                "--drop": p.drop,
                "--i": i,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className={styles.print}
              aria-label={`Open the print: ${p.title}`}
              data-cursor="VIEW"
              onPointerEnter={() => {
                audio.blip("hover");
              }}
              onClick={() => {
                setOpen(i);
              }}
            >
              <span className={styles.pin} aria-hidden="true" />
              <span className={styles.paper}>
                {/* Plain <img>: static export. The small size shows first, the browser picks. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset(fanartThumb(p.n))}
                  srcSet={`${asset(fanartThumb(p.n))} 640w, ${asset(fanartPath(p.n))} 1600w`}
                  sizes={SIZES}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                <span className={styles.sheen} aria-hidden="true" />
              </span>
            </button>
            <figcaption className={styles.slip}>
              <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
              <b>{p.title}</b>
              <em>Fanart, made by fans</em>
            </figcaption>
          </figure>
        ))}
        <aside className={styles.note}>
          <span className={styles.notePin} aria-hidden="true" />
          <p>Every print belongs to the artist who made it. Their marks stay on it.</p>
        </aside>
      </div>

      <ImageViewer
        items={ITEMS}
        index={open}
        onIndexChange={setOpen}
        label="Vexana fanart"
        skin={{ ground: "#0b0716", keyline: "#b79cf2", accent: "#e040a0" }}
      />
    </section>
  );
}
