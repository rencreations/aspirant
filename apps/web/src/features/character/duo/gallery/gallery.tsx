"use client";

import { useMemo, useState } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { NAMES, PARTNER, type Who } from "../duo-data";
import { STILLS, splashPath } from "../duo-media";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./gallery.module.css";

const CREDIT = { name: "Moonton", platform: "Mobile Legends: Bang Bang" } as const;

const SKIN: Record<Who, { ground: string; keyline: string; accent: string }> = {
  ruby: { ground: "#0a0f24", keyline: "#5fc8ff", accent: "#f2b83b" },
  angela: { ground: "#2a1422", keyline: "#ffb28c", accent: "#ff7fc0" },
};

/**
 * Official art of the pair: her splash art, her partner's, and three stills of the trailer. A
 * tile opens the site's viewer (zoom, arrows, info). The tiles are set slightly off the grid
 * and straighten when they are pointed at.
 */
export function Gallery({ who }: { who: Who }) {
  const ref = useReveal<HTMLElement>();
  const [open, setOpen] = useState<number | null>(null);
  const other = PARTNER[who];

  const items = useMemo<ViewerImage[]>(() => {
    const splash = (w: Who): ViewerImage => ({
      src: asset(splashPath(w)),
      thumb: asset(`/img/char/${w}/splash-sm.webp`),
      alt: `${NAMES[w]}, official splash art`,
      width: 2048,
      height: 1152,
      title: `${NAMES[w]}, splash art`,
      set: "official",
      setLabel: "Official art",
      credit: CREDIT,
    });
    return [
      splash(who),
      splash(other),
      ...STILLS.map((p, i): ViewerImage => ({
        src: asset(p),
        thumb: asset(p),
        alt: `Ruby and Angela, still ${i + 1} of the trailer`,
        width: 1280,
        height: 540,
        title: `Trailer, still ${i + 1}`,
        set: "official",
        setLabel: "Official art",
        credit: CREDIT,
      })),
    ];
  }, [who, other]);

  return (
    <section ref={ref} className={styles.section} data-who={who} aria-labelledby={`${who}-gallery`}>
      <Head
        id={`${who}-gallery`}
        index="07"
        label="Official art"
        title={who === "ruby" ? "Plates" : "Pictures"}
      >
        {`Five pieces of official art of ${NAMES[who]} and ${NAMES[other]}. Open one to look closely.`}
      </Head>
      <ul className={styles.grid}>
        {items.map((it, i) => (
          <li
            key={it.src}
            className={styles.cell}
            data-i={i}
            data-reveal
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <button
              type="button"
              className={styles.tile}
              onClick={() => {
                audio.blip("click");
                setOpen(i);
              }}
              aria-label={`Open ${it.title}`}
              data-cursor="OPEN"
            >
              {/* Plain <img>: static export. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.thumb} alt="" loading="lazy" draggable={false} />
              <span className={styles.cap}>{it.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <ImageViewer
        items={items}
        index={open}
        onIndexChange={setOpen}
        label="Ruby and Angela, official art"
        skin={SKIN[who]}
      />
    </section>
  );
}
