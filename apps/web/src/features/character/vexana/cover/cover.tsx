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

/** Height of the tab above the panel's top edge, px. It is hidden above the screen once the panel is in. */
const TAB = 48;

/**
 * The cover-up. This section does not scroll in like the others: the section before it stays where it
 * is (it is counter-moved by exactly the distance the page scrolls) and this panel rises and covers it,
 * with a shadow thrown up onto what it covers. Then the panel holds while the picture slowly pushes in,
 * and the film plays muted by itself while it is in view. The play button opens the site's player with
 * the full film and its sound.
 *
 * Only `transform` and `opacity` move: the section before it gets a translate, the shadow an opacity,
 * the picture a scale.
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

  // The cover-up itself, and the push-in.
  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const behind = root.previousElementSibling as HTMLElement | null;
    const triggers: ScrollTrigger[] = [];

    triggers.push(
      ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "top top",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          const travelled = p * window.innerHeight;
          if (behind) behind.style.transform = `translate3d(0, ${travelled}px, 0)`;
          if (shade.current) shade.current.style.opacity = String(Math.min(1, p * 1.15));
        },
        onLeaveBack: () => {
          if (behind) behind.style.transform = "";
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
      if (behind) behind.style.transform = "";
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
      <div className={styles.pin} style={{ top: -TAB, height: `calc(100vh + ${TAB}px)` }}>
        <svg
          className={styles.tab}
          viewBox="0 0 360 48"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M0 48C70 48 78 0 150 0H210C282 0 290 48 360 48Z" />
        </svg>
        <div className={styles.panel} style={{ top: TAB }}>
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
