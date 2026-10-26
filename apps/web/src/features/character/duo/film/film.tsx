"use client";

import { VideoCard } from "@/components/video-player/video-card";
import { asset } from "@/lib/asset";

import type { VideoItem } from "../../media";
import { FRAME_SECONDS, clock, type Who } from "../duo-data";
import { FRAMES, framePath } from "../duo-media";
import { Head } from "../ui/head";
import { useReveal } from "../use-reveal";
import styles from "./film.module.css";

interface Props {
  who: Who;
  name: string;
  label: string;
  videos: readonly VideoItem[];
}

const SKIN: Record<Who, { ink: string; keyline: string; accent: string }> = {
  ruby: { ink: "#0a0f24", keyline: "#5fc8ff", accent: "#f2b83b" },
  angela: { ink: "#2a1422", keyline: "#ffb28c", accent: "#e23a92" },
};

function player(v: VideoItem, who: Who) {
  return {
    sources: [{ label: "Original", height: v.height, src: v.src }],
    poster: v.poster,
    title: v.title,
    ...(v.captions ? { captions: v.captions } : {}),
    skin: SKIN[who],
  };
}

/**
 * Her own film, large, then a strip of stills from it that drifts past like film in a gate, then
 * the other films of the pair. The strip loops on the compositor (one transform) and stops when
 * it is off screen or pointed at.
 */
export function Film({ who, name, label, videos }: Props) {
  const ref = useReveal<HTMLElement>();
  const main = videos.find((v) => v.id === who) ?? videos[0];
  const rest = videos.filter((v) => v !== main);
  const seconds = FRAME_SECONDS[who];
  const strip = [...FRAMES, ...FRAMES];
  if (!main) return null;
  return (
    <section ref={ref} className={styles.section} data-who={who} aria-labelledby={`${who}-film`}>
      <Head
        id={`${who}-film`}
        index="03"
        label={label}
        title={who === "ruby" ? "The reel" : "Memory"}
      >
        {who === "ruby"
          ? `${name}'s own film. It plays from the start, with sound.`
          : `${name}'s own film. She remembers it in this order.`}
      </Head>
      <div className={styles.main} data-reveal>
        <VideoCard
          className={styles.card}
          tag="Film"
          duration={main.durationSec}
          video={player(main, who)}
        />
      </div>
      <div className={styles.strip} aria-hidden="true">
        <ul className={styles.track}>
          {strip.map((n, i) => (
            <li key={i} className={styles.frame}>
              {/* Plain <img>: static export. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(framePath(who, n))} alt="" loading="lazy" draggable={false} />
              <span>{clock(seconds[n - 1] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
      <ul className={styles.rest}>
        {rest.map((v, i) => (
          <li key={v.id} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
            <VideoCard
              className={styles.small}
              tag={v.title}
              duration={v.durationSec}
              video={player(v, who)}
            />
            <p className={styles.caption}>{v.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
