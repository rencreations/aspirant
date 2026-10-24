"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { videoFile, videoPoster } from "../media";
import { PlayerButton, videoFor } from "../shared/player-button";
import styles from "./cover.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * The cover-up. This section does not scroll in like the others: it overlaps the section before it
 * (`margin-top: -100lvh`, and that section keeps its stage stuck for that screen: see `.track` in
 * faces.module.css), so plain scrolling makes this panel rise and cover it, with a shadow thrown up
 * onto what it covers. There is no script moving the section underneath, so nothing can lag behind a
 * fast or touch scroll and leave a gap. Then the panel holds while the picture slowly pushes in, and
 * the film plays muted by itself while it is in view. The play button opens the site's player with
 * the full film and its sound.
 *
 * Only `transform` and `opacity` move: the shadow gets an opacity and the picture a scale.
 */
export function Cover() {
  const reduced = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const zoom = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  // The film: the loaded copy if the page has it in memory, else the file. Set after mount so the
  // server and the first client render agree.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.defaultMuted = true;
    el.muted = true;
    el.src = mediaUrl(videoFile("final2-loop"));
  }, []);

  // Plays only while it is on screen, and never under reduced motion.
  useEffect(() => {
    const el = video.current;
    const root = section.current;
    if (!el || !root || reduced) return;
    let visible = false;
    const sync = () => {
      if (visible && document.visibilityState === "visible") void el.play().catch(() => undefined);
      else el.pause();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        sync();
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      el.pause();
    };
  }, [reduced]);

  // The shadow on what is covered, and the push-in of the picture.
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const triggers: ScrollTrigger[] = [];

    triggers.push(
      ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "top top",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (shade.current)
            shade.current.style.opacity = String(Math.min(1, self.progress * 1.15));
        },
        onLeaveBack: () => {
          if (shade.current) shade.current.style.opacity = "0";
        },
      }),
    );

    if (!reduced) {
      triggers.push(
        ScrollTrigger.create({
          trigger: root,
          start: "top bottom",
          end: "bottom bottom",
          onUpdate: (self) => {
            if (zoom.current) {
              zoom.current.style.transform = `scale(${(1.12 + self.progress * 0.12).toFixed(4)})`;
            }
          },
        }),
      );
    }

    return () => {
      for (const t of triggers) t.kill();
    };
  }, [reduced]);

  return (
    <section
      ref={section}
      id="cover"
      className={styles.cover}
      data-theme="storm"
      aria-labelledby="cover-title"
    >
      <div ref={shade} className={styles.shade} aria-hidden="true" />
      <div className={styles.pin}>
        <div className={styles.panel}>
          <div ref={zoom} className={styles.zoom}>
            <video
              ref={video}
              className={styles.film}
              poster={videoPoster("final2")}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          <div className={styles.veil} aria-hidden="true" />
          <div className={styles.copy}>
            <p className={styles.kicker}>Interlude</p>
            <h2 id="cover-title" className={styles.title}>
              <span>She carries</span>
              <span className={styles.serif}>all of it.</span>
            </h2>
            <p className={styles.text}>
              Alone in the ruins, with a staff that is too heavy and a promise that is heavier. Then
              someone comes back for her.
            </p>
          </div>
          <PlayerButton
            className={styles.play}
            label="Play the film with sound"
            video={videoFor("final2", "Vexana, the one who carries it all")}
          >
            <span className={styles.ring} aria-hidden="true" />
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            <span className={styles.playLabel}>Watch with sound</span>
          </PlayerButton>
        </div>
      </div>
    </section>
  );
}
