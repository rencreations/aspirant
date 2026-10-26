"use client";

import { useRef } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useInView, useMounted } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { videoFile, videoPoster } from "../media";
import { PlayerButton, videoFor } from "../shared/player-button";
import { useVisiblePlay } from "../../vexana/shared/use-visible-play";
import styles from "./music-video.module.css";

const TITLE = "CROSSxCREDO: Guinevere Version";

/** The people behind the song, as the music video itself credits them. */
const CREDITS = [
  ["Composer and arranger", "Nika Lenz"],
  ["Lyricist", "Konomi Fujimura"],
  ["Vocal", "Eye"],
] as const;

/** The bars of the level meter. Their heights are a fixed pattern, not a reading of the song. */
const BARS = Array.from({ length: 44 }, (_, i) => ({
  // Rounded to a fixed number of places: the server and the browser must print the same text.
  h: (0.28 + 0.72 * Math.abs(Math.sin(i * 0.83 + 0.4) * Math.cos(i * 0.31))).toFixed(3),
  d: (-((i * 0.37) % 1.8)).toFixed(2),
}));

/**
 * Her theme, as a music video: the page's last quiet stop before her best friend. The picture
 * plays muted by itself while it is on screen. The button under it depends on the site's sound:
 * with the sound off it says "Hear audio" (and turns the sound on), with the sound on it says
 * "Listen". Either way the music video opens in the site's player from its first second, with the
 * song. The page's own music steps aside while the player is open.
 */
export function MusicVideo() {
  const root = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const seen = useInView(root, { threshold: 0.2, once: true });
  const mounted = useMounted();
  const muted = useSiteStore((s) => s.muted);
  const off = mounted && muted;

  useVisiblePlay(video, frame, videoFile("music"));

  return (
    <section
      ref={root}
      id="music"
      className={styles.music}
      data-theme="storm"
      data-in={seen}
      data-sound={off ? "off" : "on"}
      aria-labelledby="music-title"
    >
      <div className={styles.lights} aria-hidden="true">
        <span className={styles.spotA} />
        <span className={styles.spotB} />
        <span className={styles.floor} />
      </div>

      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <i aria-hidden="true" />
          <span>Her theme</span>
        </p>
        <h2 id="music-title" className={styles.title}>
          <span className={styles.cross}>
            CROSS<em>x</em>CREDO:
          </span>{" "}
          <span className={styles.serif}>Guinevere Version</span>
        </h2>
      </header>

      <div className={styles.stage}>
        <div ref={frame} className={styles.frame}>
          {/* Plain <video>: muted and looping, started by the hook while it is on screen. */}
          <video
            ref={video}
            className={styles.video}
            poster={asset(videoPoster("music"))}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
            aria-hidden="true"
          />
          <span className={styles.corner} data-pos="tl" aria-hidden="true" />
          <span className={styles.corner} data-pos="tr" aria-hidden="true" />
          <span className={styles.corner} data-pos="bl" aria-hidden="true" />
          <span className={styles.corner} data-pos="br" aria-hidden="true" />
        </div>

        <div className={styles.deck}>
          <PlayerButton
            video={videoFor("music", TITLE)}
            label={
              off
                ? "Hear audio: turn the site's sound on and play the music video with sound"
                : "Listen: play the music video from the beginning, with sound"
            }
            className={styles.cta}
            onOpen={() => {
              if (useSiteStore.getState().muted) {
                audio.unlock();
                useSiteStore.getState().setMuted(false);
              }
            }}
          >
            <span className={styles.ctaIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                {off ? (
                  <path
                    d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                ) : (
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                )}
              </svg>
            </span>
            <span className={styles.ctaText}>
              <b>{off ? "Hear audio" : "Listen"}</b>
              <small>
                {off ? "The sound is off. This turns it on." : "From the first second."}
              </small>
            </span>
          </PlayerButton>

          <div className={styles.meter} aria-hidden="true">
            {BARS.map((b, i) => (
              <i key={i} style={{ ["--h" as string]: b.h, animationDelay: `${b.d}s` }} />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.sleeve}>
        <svg className={styles.disc} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <circle cx="100" cy="100" r="98" fill="#201208" stroke="#f4d4ba" strokeOpacity="0.5" />
          {[88, 80, 72, 64, 56, 48].map((r) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#f4d4ba"
              strokeOpacity="0.16"
            />
          ))}
          <path d="M100 100 L100 4 A96 96 0 0 1 188 62 Z" fill="#e05c57" fillOpacity="0.14" />
          <circle cx="100" cy="100" r="30" fill="#d79965" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="#f4e3d6" strokeOpacity="0.6" />
          <path
            d="M100 82 L104 96 L118 100 L104 104 L100 118 L96 104 L82 100 L96 96 Z"
            fill="#fff"
          />
          <circle cx="100" cy="100" r="3.2" fill="#201208" />
        </svg>

        <dl className={styles.credits}>
          {CREDITS.map(([role, name]) => (
            <div key={role}>
              <dt>{role}</dt>
              <dd>{name}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
