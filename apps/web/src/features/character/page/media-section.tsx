"use client";

import { useState } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import type { FrameShape } from "@/components/frame/frame-shapes";
import { Lightbox, type LightboxItem } from "@/components/ui/lightbox";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import type { ArtImage } from "../art";
import type { FanArtItem, VideoItem } from "../media";
import styles from "./media-section.module.css";
import { SectionHead } from "./section-head";

interface MediaSectionProps {
  name: string;
  official: ReadonlyArray<ArtImage & { caption: string }>;
  fanart: readonly FanArtItem[];
  videos: readonly VideoItem[];
}

const SHAPES: readonly FrameShape[] = ["chamfer", "parallelogram", "ticket", "arch", "star"];
const pad = (n: number) => String(n).padStart(2, "0");

function minutes(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Official art, films and fan art. */
export function MediaSection({ name, official, fanart, videos }: MediaSectionProps) {
  const [box, setBox] = useState<{ set: "official" | "fan"; index: number } | null>(null);

  const officialItems: LightboxItem[] = official.map((a) => ({
    type: "image",
    src: a.src,
    alt: a.alt,
    width: a.width,
    height: a.height,
    caption: a.caption,
  }));
  const fanItems: LightboxItem[] = fanart.map((f) => ({
    type: "image",
    src: f.src,
    alt: `${f.title}, fan art`,
    width: f.width,
    height: f.height,
    caption: f.title,
    credit: f.url ? { name: f.credit, href: f.url } : { name: f.credit },
  }));

  return (
    <section aria-labelledby="media-title" className={`${styles.section} shell`}>
      <SectionHead id="media-title" index="04" code="Media archive" title="Gallery">
        {`Official art of ${name}${videos.length ? ", films" : ""}${fanart.length ? " and fan art, always with the artist's credit" : ""}.`}
      </SectionHead>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          <span className="hud-label">A / {pad(official.length)}</span> Official art
        </h3>
        <ul className={styles.official}>
          {official.map((a, i) => (
            <li key={a.src} className={styles.officialItem} data-wide={a.width > a.height}>
              <button
                type="button"
                className={styles.open}
                onClick={() => {
                  audio.blip("click");
                  setBox({ set: "official", index: i });
                }}
                aria-label={`Open ${a.alt}`}
                data-cursor="VIEW"
              >
                <Frame
                  shape={SHAPES[i % SHAPES.length] ?? "chamfer"}
                  className={styles.officialFrame}
                  label={a.caption}
                  as="span"
                >
                  <FrameImage
                    src={a.src.replace("/splash.webp", "/splash-sm.webp")}
                    srcSet={
                      a.src.endsWith("/splash.webp")
                        ? `${a.src.replace("/splash.webp", "/splash-sm.webp")} 800w, ${a.src} 2048w`
                        : undefined
                    }
                    sizes="(min-width: 56.25em) 50vw, 100vw"
                    alt=""
                    width={a.width}
                    height={a.height}
                    parallax={4}
                  />
                </Frame>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {videos.length > 0 && <Cinema videos={videos} />}

      {fanart.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            <span className="hud-label">D / {pad(fanart.length)}</span> Fan art
          </h3>
          <p className={styles.blockNote}>
            Made by fans and shown with thanks. Each piece links to the original where we know it.
          </p>
          <ul className={styles.fan}>
            {fanart.map((f, i) => (
              <li key={f.id} className={styles.fanItem}>
                <button
                  type="button"
                  className={styles.open}
                  onClick={() => {
                    audio.blip("click");
                    setBox({ set: "fan", index: i });
                  }}
                  aria-label={`Open ${f.title}, fan art by ${f.credit}`}
                  data-cursor="VIEW"
                >
                  <Frame
                    shape={i % 4 === 1 ? "ticket" : "chamfer"}
                    as="span"
                    className={styles.fanFrame}
                  >
                    <FrameImage
                      src={f.srcSm}
                      alt=""
                      width={f.width}
                      height={f.height}
                      sizes="(min-width: 56.25em) 30vw, 50vw"
                    />
                  </Frame>
                </button>
                <p className={styles.credit}>
                  <span className={styles.creditWho}>{f.credit}</span>
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.creditLink}
                    >
                      Original<span className="sr-only">: {f.title} (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className={styles.creditNone}>No link known</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Lightbox
        items={box?.set === "fan" ? fanItems : officialItems}
        index={box ? box.index : null}
        onIndexChange={(i) => setBox((b) => (i === null || !b ? null : { set: b.set, index: i }))}
        label={box?.set === "fan" ? "Fan art" : "Official art"}
      />
    </section>
  );
}

function Cinema({ videos }: { videos: readonly VideoItem[] }) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const video = videos[selected] ?? videos[0];
  if (!video) return null;
  const vertical = video.height > video.width;

  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>
        <span className="hud-label">C / {pad(videos.length)}</span> Films
      </h3>
      <div className={styles.cinema}>
        <div className={styles.screen} data-vertical={vertical}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.screenBlur} src={asset(video.poster)} alt="" aria-hidden="true" />
          {playing ? (
            <video
              key={video.id}
              className={styles.video}
              src={asset(video.src)}
              poster={asset(video.poster)}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={video.title}
            >
              {video.captions && (
                <track
                  kind="subtitles"
                  srcLang="en"
                  label="English"
                  src={asset(video.captions)}
                  default
                />
              )}
            </video>
          ) : (
            <button
              type="button"
              className={styles.posterButton}
              onClick={() => {
                audio.unlock();
                audio.stopVoice();
                audio.blip("confirm");
                setPlaying(true);
              }}
              data-cursor="PLAY"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(video.poster)} alt="" loading="lazy" decoding="async" />
              <span className={styles.playMark} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8 5l11 7-11 7z" fill="currentColor" />
                </svg>
              </span>
              <span className="sr-only">Play {video.title}</span>
            </button>
          )}
        </div>
        <div className={styles.screenMeta}>
          <p className={styles.screenTitle}>{video.title}</p>
          <p className="hud-label">
            {minutes(video.durationSec)}
            {video.captions ? " / English subtitles" : ""}
          </p>
        </div>
        <ul className={styles.playlist} aria-label="Films">
          {videos.map((v, i) => (
            <li key={v.id}>
              <button
                type="button"
                className={styles.reel}
                aria-pressed={i === selected}
                onClick={() => {
                  audio.blip("click");
                  setSelected(i);
                  setPlaying(false);
                }}
              >
                <span className={styles.reelThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(v.poster)} alt="" loading="lazy" decoding="async" />
                </span>
                <span className={styles.reelText}>
                  <span className={styles.reelTitle}>{v.title}</span>
                  <span className={styles.reelTime}>{minutes(v.durationSec)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
